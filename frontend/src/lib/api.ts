import type {
  Api,
  ApiError,
  Destination,
  ExportFormat,
  Preferences,
  RecommendRequest,
  Recommendation,
  Season,
  Spot,
  SpotInput,
  Trip,
  Visit,
  VisitInput,
} from "./types";

const BASE_URL = "";

const REQUEST_TIMEOUT_MS = 20_000;

const DEVICE_ID_KEY = "device_id";

/** Stable per-browser device id persisted in localStorage (足迹 / visits). */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

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

function assertVisit(v: unknown): asserts v is Visit {
  assertDefined(isObject(v) ? v.id : undefined, "Visit.id");
  assertDefined(isObject(v) ? v.attraction_name : undefined, "Visit.attraction_name");
}

function assertSpot(v: unknown): asserts v is Spot {
  assertDefined(isObject(v) ? v.id : undefined, "Spot.id");
  assertDefined(isObject(v) ? v.name : undefined, "Spot.name");
  assertDefined(isObject(v) ? v.lat : undefined, "Spot.lat");
  assertDefined(isObject(v) ? v.lng : undefined, "Spot.lng");
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
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
    } catch (err) {
      if (controller.signal.aborted && !(err instanceof ApiClientError)) {
        throw new ApiClientError("リクエストがタイムアウトしました（再試行してください）");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    return this.fetchJson<Record<string, unknown>>("/health");
  }

  async getVersion(): Promise<{ sha: string }> {
    return this.fetchJson<{ sha: string }>("/api/version");
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

  async getVisits(): Promise<Visit[]> {
    const data = await this.fetchJson<unknown[]>(
      `/api/visits?device_id=${encodeURIComponent(deviceId())}`,
    );
    return narrowArray(data, assertVisit);
  }

  async addVisit(input: VisitInput): Promise<Visit> {
    const data = await this.fetchJson<unknown>(
      `/api/visits?device_id=${encodeURIComponent(deviceId())}`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    assertVisit(data);
    return data;
  }

  async deleteVisit(id: number): Promise<void> {
    await this.fetchJson<unknown>(
      `/api/visits/${id}?device_id=${encodeURIComponent(deviceId())}`,
      { method: "DELETE" },
    );
  }

  async completeTrip(id: number, stops: string[]): Promise<Trip> {
    const data = await this.fetchJson<unknown>(`/api/trips/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ stops }),
    });
    assertTrip(data);
    return data;
  }

  async listSpots(destinationId?: number): Promise<Spot[]> {
    const params = new URLSearchParams({ device_id: deviceId() });
    if (destinationId != null) params.set("destination_id", String(destinationId));
    const data = await this.fetchJson<unknown[]>(
      `/api/spots?${params.toString()}`,
    );
    return narrowArray(data, assertSpot);
  }

  async createSpot(input: SpotInput): Promise<Spot> {
    const data = await this.fetchJson<unknown>("/api/spots", {
      method: "POST",
      body: JSON.stringify(input),
    });
    assertSpot(data);
    return data;
  }

  async uploadSpotPhoto(file: File): Promise<{ url: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${this.baseUrl}/api/spots/photo`, {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err = errBody as ApiError;
        throw new ApiClientError(err.detail ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { url: string };
    } catch (err) {
      if (controller.signal.aborted && !(err instanceof ApiClientError)) {
        throw new ApiClientError("リクエストがタイムアウトしました（再試行してください）");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async deleteSpot(id: number): Promise<void> {
    await this.fetchJson<unknown>(
      `/api/spots/${id}?device_id=${encodeURIComponent(deviceId())}`,
      { method: "DELETE" },
    );
  }
}

export function createApi(): Api {
  return new FetchApi(BASE_URL);
}

export { ApiClientError };
