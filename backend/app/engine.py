"""Pure-function recommendation engine.  No IO, no DB."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


# ---------------------------------------------------------------------------
# Data‑classes for typed inputs / outputs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Destination:
    id: int
    name: str
    country: str
    region: str
    description: str
    best_season: str | None
    tags: list[str]
    cost_level_1: int
    cost_level_2: int
    cost_level_3: int
    cost_level_4: int


@dataclass(frozen=True)
class Filters:
    start_date: str
    end_date: str
    origin: str | None = None
    budget: float | None = None
    interests: list[str] = field(default_factory=list)
    region: str | None = None
    holiday_type: str | None = None


@dataclass(frozen=True)
class HistoryEntry:
    destination_id: int
    end_date: str


@dataclass(frozen=True)
class Preference:
    category: str
    value: str
    weight: float = 1.0


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SEASON_BY_MONTH = {
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
    12: "winter", 1: "winter", 2: "winter",
}

_NEARBY_REGIONS = {"East Asia", "Southeast Asia"}

# Approx min trip days for a region to be sensibly reachable
_REGION_MIN_DAYS = {
    "East Asia": 1,
    "Southeast Asia": 1,
    "South Asia": 2,
    "West Asia": 2,
    "Middle East": 2,
    "Oceania": 3,
    "North America": 3,
    "South America": 4,
    "Africa": 4,
    "Europe": 3,
}

# Distance feasibility by trip length category
_TRIP_CAT_BY_DAYS = {
    (1, 3): "short",
    (4, 6): "medium",
    (7, 99): "long",
}

_RECENT_WINDOW_DAYS = 90
_BASE_DAILY_COST = 20_000


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _trip_days(start: str, end: str) -> int:
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return (e - s).days + 1


def _trip_category(days: int) -> str:
    for (lo, hi), cat in _TRIP_CAT_BY_DAYS.items():
        if lo <= days <= hi:
            return cat
    return "long"


def _cost_for_level(dest: Destination, trip_days: int) -> int:
    """Pick the right cost_level column for the trip length."""
    if trip_days <= 2:
        return dest.cost_level_1
    if trip_days <= 4:
        return dest.cost_level_2
    if trip_days <= 7:
        return dest.cost_level_3
    return dest.cost_level_4


def _season_for_date(iso: str) -> str:
    month = date.fromisoformat(iso).month
    return _SEASON_BY_MONTH[month]


# ---------------------------------------------------------------------------
# Main engine
# ---------------------------------------------------------------------------

def recommend(
    destinations: list[dict[str, Any]],
    filters: dict[str, Any],
    history: list[dict[str, Any]] | None = None,
    preferences: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Rank destinations by fit for a trip.

    Pure function – no IO.  Deterministic: same inputs ⇒ same order.

    **Hard filters** (destination excluded if violated):
      - Budget: estimated cost (cost_level × base) must be ≤ ``budget``.
      - Region: must equal ``filters["region"]`` when provided.
      - Trip-length feasibility: short trips only allow nearby regions.
      - Season: destination's best_season must match the trip month.
      - Recent-trip exclusion: destinations visited in the last 90 days.

    **Scoring**:
      - Preference dot product (category/value/weight).
      - Interest overlap from ``filters["interests"]``.
      - Trip-length fit.
      - Recent-trip deweight; novelty bonus for never-visited.
    """
    f = Filters(**filters)
    trip_days = _trip_days(f.start_date, f.end_date)
    trip_cat = _trip_category(trip_days)
    trip_season = _season_for_date(f.start_date)

    hist = [HistoryEntry(**h) for h in (history or [])]
    prefs = [Preference(**p) for p in (preferences or [])]

    # Recent-trip exclusion window (90 days before trip end)
    end = date.fromisoformat(f.end_date)
    recent_ids = {
        h.destination_id
        for h in hist
        if (end - date.fromisoformat(h.end_date)).days <= _RECENT_WINDOW_DAYS
    }
    visited_ids = {h.destination_id for h in hist}

    results: list[dict[str, Any]] = []

    for raw in destinations:
        dest = raw if isinstance(raw, Destination) else Destination(**raw)
        reasons: list[str] = []

        # ---- hard filter: recent visit exclusion ----
        if dest.id in recent_ids:
            continue

        # ---- hard filter: budget ----
        if f.budget is not None:
            level = _cost_for_level(dest, trip_days)
            estimated_total = level * _BASE_DAILY_COST * trip_days
            if estimated_total > f.budget:
                continue

        # ---- hard filter: region ----
        if f.region and dest.region != f.region:
            continue

        # ---- hard filter: trip-length feasibility ----
        if trip_cat == "short" and dest.region not in _NEARBY_REGIONS:
            continue

        # ---- hard filter: season ----
        if dest.best_season and dest.best_season != trip_season:
            continue

        # ---- scoring ----
        score = 0.0
        matched_interests: list[str] = []

        for pref in prefs:
            if pref.category == "interest" and pref.value in dest.tags:
                score += pref.weight * 30
                matched_interests.append(pref.value)
            elif pref.category == "region" and pref.value == dest.region:
                score += pref.weight * 20
            elif pref.category == "budget" and pref.value == "low":
                if _cost_for_level(dest, trip_days) <= 3:
                    score += pref.weight * 15

        if matched_interests:
            reasons.append(f"Matches interests: {', '.join(matched_interests)}")

        if f.interests:
            overlap = sorted(set(f.interests) & set(dest.tags))
            if overlap:
                score += len(overlap) * 10
                reasons.append(f"Matches filter interests: {', '.join(overlap)}")

        if trip_cat == "short" and dest.region in _NEARBY_REGIONS:
            score += 10
            reasons.append("Good fit for short trip (nearby)")
        elif trip_cat == "long" and dest.region not in _NEARBY_REGIONS:
            score += 10
            reasons.append("Good fit for longer trip")

        if dest.id in visited_ids:
            score -= 30
            reasons.append("Previously visited – lower priority")
        else:
            score += 5
            reasons.append("Novel destination")

        # Normalise into 0-100
        final_score = max(0.0, min(100.0, score))

        results.append({
            "destination": {
                "id": dest.id,
                "name": dest.name,
                "country": dest.country,
                "region": dest.region,
                "description": dest.description,
                "best_season": dest.best_season,
                "tags": dest.tags,
                "cost_level_1": dest.cost_level_1,
                "cost_level_2": dest.cost_level_2,
                "cost_level_3": dest.cost_level_3,
                "cost_level_4": dest.cost_level_4,
            },
            "score": round(final_score, 1),
            "reasons": reasons,
            "matched_interests": matched_interests,
        })

    results.sort(key=lambda r: (-r["score"], r["destination"]["name"]))
    return results
