import type {
  Api,
  Destination,
  ExportFormat,
  Preferences,
  RecommendRequest,
  Recommendation,
  Season,
  Trip,
  Visit,
  VisitInput,
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
    cost_level_1: 7,
    cost_level_2: 6,
    cost_level_3: 4,
    cost_level_4: 3,
    attractions: [
      {
        name: "伏見稲荷大社",
        day: 1,
        url: "https://inari.jp/",
        booking_url: "https://inari.jp/",
        phone: "075-641-7331",
        address: "京都市伏見区深草薮之内町68",
      },
      {
        name: "金閣寺",
        day: 2,
        url: "https://www.shokoku-ji.jp/kinkaku/",
        booking_url: "https://www.shokoku-ji.jp/kinkaku/",
        phone: "075-461-5226",
        address: "京都市北区金閣寺町1",
      },
    ],
    hotels: [
      {
        name: "祇園旅館 (Gion Hotel)",
        day: 1,
        url: "https://www.booking.com/searchresults.html?ss=%E7%A5%90%E5%9C%92+%E4%BA%AC%E9%83%BD",
        booking_url: "https://www.booking.com/searchresults.html?ss=%E7%A5%90%E5%9C%92+%E4%BA%AC%E9%83%BD",
        phone: "+81-75-XXX-XXXX",
        address: "京都市東山区祇園町",
      },
    ],
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
  {
    id: 11,
    name: "Fukuoka",
    country: "Japan",
    region: "Asia",
    description:
      "Kyushu's gateway city famed for yatai street stalls, the historic Kushida Shrine, and the relaxing Ohori Park.",
    best_season: "autumn",
    tags: ["city", "food", "culture", "nature"],
    cost_level_1: 5,
    cost_level_2: 4,
    cost_level_3: 3,
    cost_level_4: 2,
    attractions: [
      {
        name: "櫛田神社",
        day: 1,
        url: "https://www.hakatagiondoyamakasa.com/",
        booking_url: "",
        phone: "092-291-2951",
        address: "福岡市博多区上川端町1-41",
      },
      {
        name: "大濠公園",
        day: 1,
        url: "https://www.ohorikouen.jp/",
        booking_url: "",
        phone: "092-741-2004",
        address: "福岡市中央区大濠公園1-4",
      },
    ],
    hotels: [
      {
        name: "キャナルシティ地区ホテル",
        day: 1,
        url: "https://www.booking.com/searchresults.html?ss=%E7%A6%8F%E5%B2%A1+%E3%82%AD%E3%83%A3%E3%83%8A%E3%83%AB%E3%82%B7%E3%83%86%E3%82%A3",
        booking_url: "https://www.booking.com/searchresults.html?ss=%E7%A6%8F%E5%B2%A1",
        phone: "+81-92-XXX-XXXX",
        address: "福岡市博多区住吉",
      },
    ],
    image_url: "https://example.com/fukuoka.jpg",
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
    status: "planned",
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
    status: "planned",
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
  private visits: Visit[] = [];
  private nextVisitId = 1;

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

  async getVisits(): Promise<Visit[]> {
    await this.delay();
    return this.visits.map((v) => ({ ...v }));
  }

  async addVisit(input: VisitInput): Promise<Visit> {
    await this.delay();
    const visit: Visit = {
      id: this.nextVisitId++,
      destination_id: input.destination_id,
      attraction_name: input.attraction_name,
      visited_at: new Date().toISOString(),
    };
    this.visits.push(visit);
    return { ...visit };
  }

  async deleteVisit(id: number): Promise<void> {
    await this.delay();
    const idx = this.visits.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error("Visit not found");
    this.visits.splice(idx, 1);
  }

  async completeTrip(id: number, stops: string[]): Promise<Trip> {
    await this.delay();
    const idx = this.trips.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Trip not found");
    for (const name of stops) {
      const exists = this.visits.some((v) => v.attraction_name === name);
      if (!exists) {
        this.visits.push({
          id: this.nextVisitId++,
          destination_id: this.trips[idx].destination_id,
          attraction_name: name,
          visited_at: new Date().toISOString(),
        });
      }
    }
    const updated: Trip = {
      ...this.trips[idx],
      status: "completed",
      updated_at: new Date().toISOString(),
    };
    this.trips[idx] = updated;
    return { ...updated };
  }

  getDestinationById(id: number): Destination | undefined {
    return this.findByDestination(id);
  }
}

export function createMockApi(): Api {
  return new MockApi();
}
