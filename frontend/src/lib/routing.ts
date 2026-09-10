// Free walk routing via the public OSRM demo server (no key needed).
// Transit legs keep straight dashed lines: no free transit-routing API exists,
// so we don't fake rail geometry.

const OSRM_BASE = "https://router.project-osrm.org/route/v1/foot";

const cache = new Map<string, [number, number][] | null>();

function key(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  return `${a.lat.toFixed(5)},${a.lng.toFixed(5)}-${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
}

/** Decode a polyline string into [lat, lng] pairs (precision 5 = OSRM, 6 = Valhalla). */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;
  while (i < encoded.length) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

/**
 * Real road-following walking path between two points.
 * Returns null on any failure (caller falls back to a straight line).
 * Results are cached per coordinate pair for the session.
 */
export async function fetchFootPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<[number, number][] | null> {
  const k = key(a, b);
  if (cache.has(k)) return cache.get(k) ?? null;
  try {
    const url =
      `${OSRM_BASE}/${a.lng.toFixed(5)},${a.lat.toFixed(5)};` +
      `${b.lng.toFixed(5)},${b.lat.toFixed(5)}?overview=full&geometries=polyline`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      cache.set(k, null);
      return null;
    }
    const body = (await res.json()) as {
      code?: string;
      routes?: { geometry?: string }[];
    };
    const geom = body.routes?.[0]?.geometry;
    if (body.code !== "Ok" || !geom) {
      cache.set(k, null);
      return null;
    }
    const path = decodePolyline(geom);
    cache.set(k, path.length > 1 ? path : null);
    return path.length > 1 ? path : null;
  } catch {
    if (signal?.aborted) return null;
    cache.set(k, null);
    return null;
  }
}

/** Test hook: clear the session cache. */
export function clearFootCache(): void {
  cache.clear();
}

const VALHALLA_BASE = "https://valhalla1.openstreetmap.de/route";
const transitCache = new Map<string, [number, number][] | null>();

/**
 * Transit-aware path via Valhalla multimodal (bus/rail where covered).
 * Returns null when unsupported (e.g. no transit data for the area) —
 * caller keeps the straight dashed line. Cached per coordinate pair.
 */
export async function fetchTransitPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<[number, number][] | null> {
  const k = key(a, b);
  if (transitCache.has(k)) return transitCache.get(k) ?? null;
  try {
    const res = await fetch(VALHALLA_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [
          { lat: a.lat, lon: a.lng },
          { lat: b.lat, lon: b.lng },
        ],
        costing: "multimodal",
        directions_options: { language: "ja-JP" },
      }),
      signal,
    });
    if (!res.ok) {
      transitCache.set(k, null);
      return null;
    }
    const body = (await res.json()) as {
      trip?: { legs?: { shape?: string }[] };
    };
    const shape = body.trip?.legs?.[0]?.shape;
    if (!shape) {
      transitCache.set(k, null);
      return null;
    }
    const path = decodePolyline(shape, 6);
    transitCache.set(k, path.length > 1 ? path : null);
    return path.length > 1 ? path : null;
  } catch {
    if (signal?.aborted) return null;
    transitCache.set(k, null);
    return null;
  }
}

/** Test hook: clear the transit cache. */
export function clearTransitCache(): void {
  transitCache.clear();
}
