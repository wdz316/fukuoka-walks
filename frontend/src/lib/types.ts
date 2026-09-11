export type Season = "spring" | "summer" | "autumn" | "winter";
export type HolidayType = "weekend" | "three_day" | "obon" | "golden_week" | "custom";
export type AiProvider = "rule" | "openai";
export type ExportFormat = "markdown" | "ics";

export interface PlaceInfo {
  name: string;
  lat?: number;
  lng?: number;
  day?: number;
  url?: string;
  booking_url?: string;
  phone?: string;
  address?: string;
  station?: { name: string; line: string };
}

export interface Destination {
  id: number;
  name: string;
  country?: string;
  region?: string;
  description?: string;
  best_season?: Season;
  tags?: string[];
  image_url?: string;
  cost_level_1?: number;
  cost_level_2?: number;
  cost_level_3?: number;
  cost_level_4?: number;
  attractions?: PlaceInfo[];
  hotels?: PlaceInfo[];
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
  status?: string;
}

export interface Visit {
  id: number;
  destination_id?: number;
  attraction_name: string;
  visited_at?: string;
}

export interface VisitInput {
  destination_id?: number;
  attraction_name: string;
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

export interface Spot {
  id: number;
  name: string;
  description?: string;
  photo_url?: string;
  lat: number;
  lng: number;
  destination_id?: number;
  device_id?: string;
  created_at?: string;
}

export interface SpotInput {
  name: string;
  description?: string;
  photo_url?: string;
  lat: number;
  lng: number;
  destination_id?: number;
}

export interface ApiError {
  detail: string;
}

export interface Api {
  healthCheck(): Promise<Record<string, unknown>>;
  getVersion(): Promise<{ sha: string }>;
  recommend(req: RecommendRequest): Promise<Recommendation[]>;
  getDestinations(region?: string, season?: Season): Promise<Destination[]>;
  getTrips(): Promise<Trip[]>;
  saveTrip(trip: Trip): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  exportTripUrl(id: number, format?: ExportFormat): string;
  getPreferences(): Promise<Preferences | null>;
  updatePreferences(prefs: Preferences): Promise<Preferences>;
  getVisits(): Promise<Visit[]>;
  addVisit(input: VisitInput): Promise<Visit>;
  deleteVisit(id: number): Promise<void>;
  completeTrip(id: number, stops: string[]): Promise<Trip>;
  listSpots(destinationId?: number): Promise<Spot[]>;
  createSpot(input: SpotInput): Promise<Spot>;
  uploadSpotPhoto(file: File): Promise<{ url: string }>;
  deleteSpot(id: number): Promise<void>;
}
