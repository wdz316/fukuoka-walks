import type { PlaceInfo } from "./types";

export interface RouteStop {
  name: string;
  timeLabel: string;
  transport: string;
  kind: "attraction" | "hotel";
  url?: string;
  booking_url?: string;
  phone?: string;
  address?: string;
}

export interface RouteDay {
  /** Day number (1-based). `null` groups stops without day info. */
  day: number | null;
  stops: RouteStop[];
}

const SLOTS = [
  { label: "午前", transport: "徒歩・地下鉄" },
  { label: "午後", transport: "電車・バス" },
  { label: "夕方", transport: "徒歩・タクシー" },
] as const;

/**
 * Build a timed model route from a destination's attractions/hotels.
 * Attractions are grouped by their `day` field and assigned 午前/午後/夕方
 * slots in order; hotels are appended as 宿泊 stops. Stops without day info
 * are grouped under `day: null`.
 */
export function buildRoute(
  attractions: readonly PlaceInfo[] | null | undefined,
  hotels: readonly PlaceInfo[] | null | undefined,
): RouteDay[] {
  const byDay = new Map<number | null, RouteStop[]>();
  const list = attractions ?? [];
  const groups = new Map<number | null, PlaceInfo[]>();
  for (const a of list) {
    const key = typeof a.day === "number" ? a.day : null;
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }
  const orderedDays = [...groups.keys()].sort((x, y) => (x ?? 9999) - (y ?? 9999));
  for (const day of orderedDays) {
    const stops: RouteStop[] = (groups.get(day) ?? []).map((a, i) => {
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
    });
    byDay.set(day, stops);
  }
  // Hotels become 宿泊 stops on their day (or the last day when unassigned).
  const hotelList = hotels ?? [];
  for (const h of hotelList) {
    const key = typeof h.day === "number" ? h.day : null;
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
    .map(([day, stops]) => ({ day, stops }));
}
