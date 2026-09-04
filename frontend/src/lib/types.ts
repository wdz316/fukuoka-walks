export type Season = "spring" | "summer" | "autumn" | "winter";
export type HolidayType = "weekend" | "three_day" | "obon" | "golden_week" | "custom";
export type AiProvider = "rule" | "openai";
export type ExportFormat = "markdown" | "ics";

export interface Destination {
  id: number;
  name: string;
  country?: string;
  region?: string;
  description?: string;
  best_season?: Season;
  tags?: string[];
  image_url?: string;
}

export interface Trip {
  id?: number;
  title: string;
  start_date: string;
  end_date: string;
  destination_id?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecommendRequest {
  start_date: string;
  end_date: string;
  origin?: string;
  budget?: number;
  interests?: string[];
  region?: string;
  holiday_type?: HolidayType;
}

export interface Recommendation {
  destination: Destination;
  score: number;
  reason?: string;
  matched_interests?: string[];
}

export interface Preferences {
  origin?: string;
  interests?: string[];
  budget?: number;
  ai_provider?: AiProvider;
}

export interface ApiError {
  detail: string;
}

export interface Api {
  healthCheck(): Promise<Record<string, unknown>>;
  recommend(req: RecommendRequest): Promise<Recommendation[]>;
  getDestinations(region?: string, season?: Season): Promise<Destination[]>;
  getTrips(): Promise<Trip[]>;
  saveTrip(trip: Trip): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  exportTripUrl(id: number, format?: ExportFormat): string;
  getPreferences(): Promise<Preferences | null>;
  updatePreferences(prefs: Preferences): Promise<Preferences>;
}
