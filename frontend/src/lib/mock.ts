import type {
  Api,
  Destination,
  ExportFormat,
  Preferences,
  RecommendRequest,
  Recommendation,
  Season,
  Trip,
} from "./types";

const CATALOGUE: Destination[] = [
  {
    id: 1,
    name: "Kyoto",
    country: "Japan",
    region: "Asia",
    description: "Ancient temples, traditional tea houses, and seasonal foliage.",
    best_season: "autumn",
    tags: ["culture", "history", "food"],
    image_url: "https://example.com/kyoto.jpg",
  },
  {
    id: 2,
    name: "Tokyo",
    country: "Japan",
    region: "Asia",
    description: "A bustling metropolis blending ultramodern and traditional.",
    best_season: "spring",
    tags: ["city", "food", "shopping"],
    image_url: "https://example.com/tokyo.jpg",
  },
  {
    id: 3,
    name: "Hokkaido",
    country: "Japan",
    region: "Asia",
    description: "Powder snow, natural hot springs, and rugged wilderness.",
    best_season: "winter",
    tags: ["nature", "ski", "food"],
    image_url: "https://example.com/hokkaido.jpg",
  },
  {
    id: 4,
    name: "Okinawa",
    country: "Japan",
    region: "Asia",
    description: "Tropical beaches and unique Ryukyuan culture.",
    best_season: "summer",
    tags: ["beach", "nature", "diving"],
    image_url: "https://example.com/okinawa.jpg",
  },
  {
    id: 5,
    name: "Paris",
    country: "France",
    region: "Europe",
    description: "Art, romance, and world-famous landmarks.",
    best_season: "spring",
    tags: ["culture", "art", "food"],
    image_url: "https://example.com/paris.jpg",
  },
  {
    id: 6,
    name: "Rome",
    country: "Italy",
    region: "Europe",
    description: "Ancient ruins and Renaissance masterpieces.",
    best_season: "spring",
    tags: ["history", "culture", "food"],
    image_url: "https://example.com/rome.jpg",
  },
  {
    id: 7,
    name: "Bangkok",
    country: "Thailand",
    region: "Asia",
    description: "Vibrant street food, temples, and night markets.",
    best_season: "winter",
    tags: ["food", "culture", "nightlife"],
    image_url: "https://example.com/bangkok.jpg",
  },
  {
    id: 8,
    name: "Sydney",
    country: "Australia",
    region: "Oceania",
    description: "Harbour views, beaches, and a lively outdoor culture.",
    best_season: "summer",
    tags: ["beach", "nature", "city"],
    image_url: "https://example.com/sydney.jpg",
  },
  {
    id: 9,
    name: "Iceland",
    country: "Iceland",
    region: "Europe",
    description: "Waterfalls, glaciers, and the northern lights.",
    best_season: "winter",
    tags: ["nature", "adventure", "photography"],
    image_url: "https://example.com/iceland.jpg",
  },
  {
    id: 10,
    name: "Costa Rica",
    country: "Costa Rica",
    region: "Americas",
    description: "Rainforests, volcanoes, and abundant wildlife.",
    best_season: "spring",
    tags: ["nature", "adventure", "eco"],
    image_url: "https://example.com/costarica.jpg",
  },
];

const seedTrips: Trip[] = [
  {
    id: 1,
    title: "Kyoto Autumn Getaway",
    start_date: "2026-11-10",
    end_date: "2026-11-14",
    destination_id: 1,
    notes: "Momiji season temple walk",
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-01T09:00:00Z",
  },
  {
    id: 2,
    title: "Hokkaido Ski Trip",
    start_date: "2027-01-20",
    end_date: "2027-01-27",
    destination_id: 3,
    notes: "Try Niseko powder",
    created_at: "2026-08-05T12:30:00Z",
    updated_at: "2026-08-05T12:30:00Z",
  },
];

const defaultPreferences: Preferences = {
  origin: "Tokyo",
  interests: ["food", "nature"],
  budget: 2000,
  ai_provider: "rule",
};

class MockApi implements Api {
  private destinations: Destination[] = [...CATALOGUE];
  private trips: Trip[] = seedTrips.map((t) => ({ ...t }));
  private nextTripId = seedTrips.length + 1;
  private preferences: Preferences = { ...defaultPreferences };

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 150));
  }

  private findByDestination(id: number): Destination | undefined {
    return this.destinations.find((d) => d.id === id);
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    return { status: "ok" };
  }

  async recommend(req: RecommendRequest): Promise<Recommendation[]> {
    await this.delay();
    const interests = req.interests ?? [];
    const region = req.region;
    const season = this.seasonForDates(req.start_date);

    const scored = this.destinations
      .filter((d) => (region ? d.region === region : true))
      .map((d) => {
        let score = 40;
        const matched: string[] = [];
        if (d.best_season === season) {
          score += 25;
          matched.push(`best in ${season}`);
        }
        for (const interest of interests) {
          if (d.tags?.includes(interest)) {
            score += 15;
            matched.push(interest);
          }
        }
        return {
          destination: d,
          score: Math.min(100, score),
          reason: matched.length
            ? `Matches: ${matched.join(", ")}`
            : `Solid pick for ${season}`,
          matched_interests: matched,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored;
  }

  private seasonForDates(start: string): string {
    const month = new Date(start).getMonth();
    if (month === 11 || month === 0 || month === 1) return "winter";
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    return "autumn";
  }

  async getDestinations(region?: string, season?: Season): Promise<Destination[]> {
    await this.delay();
    return this.destinations.filter(
      (d) =>
        (region ? d.region === region : true) &&
        (season ? d.best_season === season : true),
    );
  }

  async getTrips(): Promise<Trip[]> {
    await this.delay();
    return this.trips.map((t) => ({ ...t }));
  }

  async saveTrip(trip: Trip): Promise<Trip> {
    await this.delay();
    const now = new Date().toISOString();
    if (trip.id == null) {
      const created: Trip = {
        ...trip,
        id: this.nextTripId++,
        created_at: now,
        updated_at: now,
      };
      this.trips.push(created);
      return { ...created };
    }
    const idx = this.trips.findIndex((t) => t.id === trip.id);
    if (idx === -1) throw new Error("Trip not found");
    const updated: Trip = { ...this.trips[idx], ...trip, updated_at: now };
    this.trips[idx] = updated;
    return { ...updated };
  }

  async deleteTrip(id: number): Promise<void> {
    await this.delay();
    const idx = this.trips.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Trip not found");
    this.trips.splice(idx, 1);
  }

  exportTripUrl(id: number, format: ExportFormat = "markdown"): string {
    void format;
    const trip = this.trips.find((t) => t.id === id);
    const title = trip ? trip.title : `trip-${id}`;
    return `data:text/markdown;charset=utf-8,${encodeURIComponent(
      `# ${title}\n\nItinerary: ${trip?.start_date} to ${trip?.end_date}\n`,
    )}`;
  }

  async getPreferences(): Promise<Preferences | null> {
    await this.delay();
    return { ...this.preferences };
  }

  async updatePreferences(prefs: Preferences): Promise<Preferences> {
    await this.delay();
    this.preferences = { ...prefs };
    return { ...this.preferences };
  }

  getDestinationById(id: number): Destination | undefined {
    return this.findByDestination(id);
  }
}

export function createMockApi(): Api {
  return new MockApi();
}
