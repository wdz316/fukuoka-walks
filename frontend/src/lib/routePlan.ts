import type { PlaceInfo } from "./types";

export interface RouteStop {
  name: string;
  timeLabel: string;
  transport: string;
  kind: "attraction" | "hotel" | "custom";
  url?: string;
  booking_url?: string;
  phone?: string;
  address?: string;
  note?: string;
  description?: string;
  photo_url?: string;
}

export interface RouteDay {
  /** Day number (1-based). `null` groups stops without day info. */
  day: number | null;
  stops: RouteStop[];
  /** Overflow spots beyond the 3 daily slots (午前/午後/夕方). */
  extras: RouteStop[];
  /** True when this group holds only user-added 自定地点 stops. */
  isCustom?: boolean;
}

export interface CustomPlace {
  name: string;
  note?: string;
  description?: string;
  photo_url?: string;
  lat?: number;
  lng?: number;
}

const SLOTS = [
  { label: "午前", transport: "徒歩・地下鉄" },
  { label: "午後", transport: "電車・バス" },
  { label: "夕方", transport: "徒歩・タクシー" },
] as const;

/** Max main-route attraction stops per day — keeps the plan relaxed. */
const MAX_STOPS_PER_DAY = SLOTS.length;

export interface RouteOptions {
  /** Trip length in days. Stops assigned to later days are dropped so a
   * 1-day trip never shows 2日目. */
  days?: number;
  /** Show 宿泊 hotel stops. Callers hide these for day trips. */
  includeHotels?: boolean;
  /** Starting point (hotel/station): prepended as the first stop of day 1. */
  origin?: { name: string; lat: number; lng: number; timeLabel?: string };
}

export interface RouteLeg {
  from: string;
  to: string;
  /** 'walk' under 1.2km, otherwise transit. */
  mode: "walk" | "transit";
  minutes: number;
  /** Concrete line, e.g. 地下鉄空港線（祇園駅→大濠公園駅）, when both ends share one. */
  line?: string;
  /** Estimated fare in yen (walk = 0; transit = rough local-fare estimate). */
  fare: number;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      s2 *
      s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Order + transport for each leg between consecutive route points.
 * Walk (<1.2km, 4km/h) else transit (15km/h + 5min wait), minutes rounded up.
 * When both ends share a station line, the leg names it explicitly.
 */
export function planLegs(
  points: readonly {
    name: string;
    lat: number;
    lng: number;
    station?: { name: string; line: string } | null;
  }[],
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const km = haversineKm(points[i], points[i + 1]);
    const a = points[i].station;
    const b = points[i + 1].station;
    const line =
      a && b && a.line === b.line
        ? `${a.line}（${a.name}→${b.name}）`
        : undefined;
    if (km < 1.2) {
      legs.push({
        from: points[i].name,
        to: points[i + 1].name,
        mode: "walk",
        minutes: Math.max(1, Math.ceil((km / 4) * 60)),
        line,
        fare: 0,
      });
    } else {
      legs.push({
        from: points[i].name,
        to: points[i + 1].name,
        mode: "transit",
        minutes: Math.ceil((km / 15) * 60) + 5,
        line,
        // Rough Fukuoka local-transit estimate (subway base + distance).
        fare: Math.min(380, 210 + Math.round(km * 30)),
      });
    }
  }
  return legs;
}

/**
 * Build a timed model route from a destination's attractions/hotels.
 * Attractions are grouped by their `day` field and assigned 午前/午後/夕方
 * slots in order; hotels are appended as 宿泊 stops. Stops without day info
 * are grouped under `day: null`.
 */
export function buildRoute(
  attractions: readonly PlaceInfo[] | null | undefined,
  hotels: readonly PlaceInfo[] | null | undefined,
  opts?: RouteOptions,
): RouteDay[] {
  const maxDay = opts?.days;
  const showHotels = opts?.includeHotels ?? true;
  const byDay = new Map<number | null, RouteStop[]>();
  const list = attractions ?? [];
  const groups = new Map<number | null, PlaceInfo[]>();
  for (const a of list) {
    const key = typeof a.day === "number" ? a.day : null;
    // Drop stops scheduled after the trip ends (e.g. Day 2 on a 1-day trip).
    if (key !== null && maxDay !== undefined && key > maxDay) continue;
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }
  const orderedDays = [...groups.keys()].sort((x, y) => (x ?? 9999) - (y ?? 9999));
  const extraMap = new Map<number | null, RouteStop[]>();
  for (const day of orderedDays) {
    const items = groups.get(day) ?? [];
    const main = items.slice(0, MAX_STOPS_PER_DAY);
    const overflow = items.slice(MAX_STOPS_PER_DAY);
    const toStop = (a: PlaceInfo, i: number): RouteStop => {
      const slot = SLOTS[i % SLOTS.length];
      return {
        name: a.name,
        timeLabel: slot.label,
        transport: slot.transport,
        kind: "attraction" as const,
        url: a.url,
        booking_url: a.booking_url,
        phone: a.phone,
        address: a.address,
      };
    };
    const stops: RouteStop[] = main.map(toStop);
    byDay.set(day, stops);
    if (overflow.length > 0) {
      const extraStops = overflow.map((a) => ({
        ...toStop(a, 0),
        timeLabel: "予備",
      }));
      byDay.set(day, stops);
      extraMap.set(day, extraStops);
    }
  }
  // Hotels become 宿泊 stops on their day (or the last day when unassigned).
  // Day trips (includeHotels === false) never show overnight stays.
  const hotelList = showHotels ? (hotels ?? []) : [];
  for (const h of hotelList) {
    const key = typeof h.day === "number" ? h.day : null;
    if (key !== null && maxDay !== undefined && key > maxDay) continue;
    const stops = byDay.get(key) ?? [];
    stops.push({
      name: h.name,
      timeLabel: "宿泊",
      transport: "チェックイン",
      kind: "hotel" as const,
      url: h.url,
      booking_url: h.booking_url,
      phone: h.phone,
      address: h.address,
    });
    byDay.set(key, stops);
  }
  if (byDay.size === 0 && !opts?.origin) return [];
  const origin = opts?.origin;
  const ordered = [...byDay.entries()].sort(([x], [y]) => (x ?? 9999) - (y ?? 9999));
  const result = ordered.map(([day, stops]) => ({ day, stops, extras: extraMap.get(day) ?? [] }));
  if (origin) {
    // Starting point goes first on day 1 so nobody teleports to stop 1.
    const first = result.find((d) => d.day === 1) ?? result[0];
    const originStop: RouteStop = {
      name: origin.name,
      timeLabel: origin.timeLabel ?? "出発",
      transport: "",
      kind: "attraction" as const,
    };
    if (first) {
      first.stops.unshift(originStop);
    } else {
      result.unshift({ day: 1, stops: [originStop], extras: [] });
    }
  }
  // If only a null-day group exists but hotels were unassigned, keep as is.
  return result;
}

/**
 * Append user-added 自定地点 (custom places) to the tail of a route.
 * Custom spots never carry coordinates, so callers must not place them on the
 * map. They are grouped into a trailing `isCustom` day so they render after
 * every scheduled stop and stay clearly labelled.
 */
export function mergeCustomPlaces(
  route: RouteDay[],
  customs: readonly CustomPlace[],
): RouteDay[] {
  if (customs.length === 0) return route;
  const stops: RouteStop[] = customs.map((c) => ({
    name: c.name,
    timeLabel: "自定",
    transport: "",
    kind: "custom" as const,
    note: c.note,
    description: c.description,
    photo_url: c.photo_url,
  }));
  return [...route, { day: null, isCustom: true, stops, extras: [] }];
}
