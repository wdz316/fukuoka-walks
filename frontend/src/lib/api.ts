import type {
  Api,
  ApiError,
  Destination,
  ExportFormat,
  Preferences,
  RecommendRequest,
  Recommendation,
  Season,
  Trip,
} from "./types";

const BASE_URL = "http://localhost:8000";

function assertDefined<T>(value: T, label: string): asserts value is NonNullable<T> {
  if (value == null) throw new ApiClientError(`${label} is missing`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function assertDestination(v: unknown): asserts v is Destination {
  assertDefined(isObject(v) ? v.id : undefined, "Destination.id");
  assertDefined(isObject(v) ? v.name : undefined, "Destination.name");
}

function assertTrip(v: unknown): asserts v is Trip {
  assertDefined(isObject(v) ? v.title : undefined, "Trip.title");
  assertDefined(isObject(v) ? v.start_date : undefined, "Trip.start_date");
  assertDefined(isObject(v) ? v.end_date : undefined, "Trip.end_date");
}

function assertRecommendation(v: unknown): asserts v is Recommendation {
  assertDefined(isObject(v) ? v.destination : undefined, "Recommendation.destination");
  assertDefined(isObject(v) ? v.score : undefined, "Recommendation.score");
  assertDestination((v as Record<string, unknown>).destination);
}

function narrowArray<T>(arr: unknown[], guard: (v: unknown) => asserts v is T): T[] {
  const out: T[] = [];
  for (const v of arr) {
    guard(v);
    out.push(v);
  }
  return out;
}

class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

class FetchApi implements Api {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetchJson<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = body as ApiError;
      throw new ApiClientError(err.detail ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    return this.fetchJson<Record<string, unknown>>("/health");
  }

  async recommend(req: RecommendRequest): Promise<Recommendation[]> {
    const data = await this.fetchJson<unknown[]>("/api/recommend", {
      method: "POST",
      body: JSON.stringify(req),
    });
    return narrowArray(data, assertRecommendation);
  }

  async getDestinations(region?: string, season?: Season): Promise<Destination[]> {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (season) params.set("season", season);
    const qs = params.toString();
    const data = await this.fetchJson<unknown[]>(`/api/destinations${qs ? `?${qs}` : ""}`);
    return narrowArray(data, assertDestination);
  }

  async getTrips(): Promise<Trip[]> {
    const data = await this.fetchJson<unknown[]>("/api/trips");
    return narrowArray(data, assertTrip);
  }

  async saveTrip(trip: Trip): Promise<Trip> {
    const data = await this.fetchJson<unknown>("/api/trips", {
      method: "POST",
      body: JSON.stringify(trip),
    });
    assertTrip(data);
    return data;
  }

  async deleteTrip(id: number): Promise<void> {
    await this.fetchJson<unknown>(`/api/trips/${id}`, {
      method: "DELETE",
    });
  }

  exportTripUrl(id: number, format: ExportFormat = "markdown"): string {
    return `${this.baseUrl}/api/trips/${id}/export?format=${format}`;
  }

  async getPreferences(): Promise<Preferences | null> {
    const res = await fetch(`${this.baseUrl}/api/preferences`);
    if (res.status === 204) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = body as ApiError;
      throw new ApiClientError(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<Preferences>;
  }

  async updatePreferences(prefs: Preferences): Promise<Preferences> {
    return this.fetchJson<Preferences>("/api/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
  }
}

export function createApi(): Api {
  return new FetchApi(BASE_URL);
}

export { ApiClientError };
