import type { HolidayType } from "./types";

export const WALK_TYPES = [
  { value: "city", label: "市内散策" },
  { value: "suburban", label: "近郊日帰り" },
  { value: "stay", label: "宿泊ステイ" },
] as const;
export type WalkType = (typeof WALK_TYPES)[number]["value"];

export const SAME_CITY_PREF_OPTIONS = [
  { value: "food", label: "グルメ" },
  { value: "nature", label: "自然" },
  { value: "culture", label: "文化" },
  { value: "family", label: "親子" },
  { value: "shopping", label: "ショッピング" },
] as const;
export type SameCityPref = (typeof SAME_CITY_PREF_OPTIONS)[number]["value"];

export const STAY_LENGTHS = [
  { value: "half", label: "半日" },
  { value: "one", label: "1日" },
  { value: "two", label: "2日" },
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