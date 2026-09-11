export interface OriginPreset {
  value: string;
  /** i18n label key. */
  label: string;
  lat: number;
  lng: number;
}

/** Boarding points for a Fukuoka city walk. No teleporting: every route
 * starts at one of these. */
export const ORIGIN_PRESETS: OriginPreset[] = [
  { value: "hakata", label: "origin.hakata", lat: 33.5897, lng: 130.4207 },
  { value: "tenjin", label: "origin.tenjin", lat: 33.5902, lng: 130.3965 },
  { value: "airport", label: "origin.airport", lat: 33.5859, lng: 130.4502 },
  { value: "nikko", label: "origin.nikko", lat: 33.589, lng: 130.412 },
];

export function originPreset(value: string | null | undefined): OriginPreset {
  return ORIGIN_PRESETS.find((o) => o.value === value) ?? ORIGIN_PRESETS[0];
}
