export interface LatLng {
  lat: number
  lng: number
}

const COORDINATES: Record<string, LatLng | undefined> = {
  Kyoto: { lat: 35.0116, lng: 135.7681 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  Hokkaido: { lat: 43.0618, lng: 141.3545 },
  Okinawa: { lat: 26.2124, lng: 127.6809 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Bangkok: { lat: 13.7563, lng: 100.5018 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Iceland: { lat: 64.1466, lng: -21.9426 },
  "Costa Rica": { lat: 9.7489, lng: -83.7534 },
}

export function coordinateFor(name: string | undefined): LatLng | null {
  if (!name) return null
  return COORDINATES[name] ?? null
}
