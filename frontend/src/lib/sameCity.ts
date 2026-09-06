import type { HolidayType } from "./types";

export const WALK_TYPES = [
  { value: "city", label: "walk.city" },
  { value: "suburban", label: "walk.suburban" },
  { value: "stay", label: "walk.stay" },
] as const;
export type WalkType = (typeof WALK_TYPES)[number]["value"];

export const SAME_CITY_PREF_OPTIONS = [
  { value: "food", label: "pref.food" },
  { value: "nature", label: "pref.nature" },
  { value: "culture", label: "pref.culture" },
  { value: "family", label: "pref.family" },
  { value: "shopping", label: "pref.shopping" },
] as const;
export type SameCityPref = (typeof SAME_CITY_PREF_OPTIONS)[number]["value"];

export const STAY_LENGTHS = [
  { value: "half", label: "stay.half" },
  { value: "one", label: "stay.one" },
  { value: "two", label: "stay.two" },
] as const;
export type StayLength = (typeof STAY_LENGTHS)[number]["value"];

const WALK_INTERESTS: Record<WalkType, string[]> = {
  city: ["city"],
  suburban: ["nature"],
  stay: ["nature"],
};

const PREF_INTERESTS: Record<SameCityPref, string> = {
  food: "food",
  nature: "nature",
  culture: "culture",
  family: "family",
  shopping: "shopping",
};

export function sameCityInterests(
  walkType: WalkType,
  prefs: readonly SameCityPref[],
): string[] {
  const out = [...WALK_INTERESTS[walkType]];
  for (const p of prefs) {
    const v = PREF_INTERESTS[p];
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export function sameCityHolidayType(walkType: WalkType): HolidayType {
  return walkType === "stay" ? "weekend" : "custom";
}

export function sameCityDurationDays(stayDays: StayLength): number {
  switch (stayDays) {
    case "half":
    case "one":
      return 0;
    case "two":
      return 1;
  }
}