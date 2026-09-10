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
  if (byDay.size === 0) return [];
  // If only a null-day group exists but hotels were unassigned, keep as is.
  return [...byDay.entries()]
    .sort(([x], [y]) => (x ?? 9999) - (y ?? 9999))
    .map(([day, stops]) => ({ day, stops, extras: extraMap.get(day) ?? [] }));
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
  }));
  return [...route, { day: null, isCustom: true, stops, extras: [] }];
}
