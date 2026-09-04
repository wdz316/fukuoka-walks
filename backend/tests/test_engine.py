"""Tests for the pure-function recommendation engine."""

import random

import pytest

from app.engine import recommend


def _dest(
    id=1,
    name="Test Place",
    country="Japan",
    region="East Asia",
    best_season="spring",
    tags=None,
    cost_level_1=5,
    cost_level_2=4,
    cost_level_3=3,
    cost_level_4=2,
):
    return {
        "id": id,
        "name": name,
        "country": country,
        "region": region,
        "description": f"{name} description",
        "best_season": best_season,
        "tags": tags or ["culture"],
        "cost_level_1": cost_level_1,
        "cost_level_2": cost_level_2,
        "cost_level_3": cost_level_3,
        "cost_level_4": cost_level_4,
    }


def _filters(**overrides):
    base = {
        "start_date": "2026-04-01",  # spring
        "end_date": "2026-04-03",    # 3-day trip
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------

def test_budget_overage_excludes_destination() -> None:
    """A destination whose estimated cost exceeds budget must never appear."""
    expensive = _dest(id=1, name="Lux", cost_level_1=10, cost_level_2=10)
    cheap = _dest(id=2, name="Budget", cost_level_1=1, cost_level_2=1)
    # 3-day trip → uses cost_level_2 (days <= 4)
    # cheap(1) => 1*20k*3 = 60k; expensive(10) => 600k
    filters = _filters(budget=300_000)

    results = recommend([expensive, cheap], filters)

    names = {r["destination"]["name"] for r in results}
    assert "Lux" not in names
    assert "Budget" in names


def test_budget_no_limit_keeps_all() -> None:
    results = recommend(
        [_dest(id=1, name="A", cost_level_1=10)],
        _filters(),
    )
    assert len(results) == 1


def test_budget_excludes_even_with_high_interest() -> None:
    """Budget is a hard filter – never outweighed by preference score."""
    pricey = _dest(id=1, name="Pricey", cost_level_1=10, tags=["food", "culture"])
    filters = _filters(budget=10_000, interests=["food"])
    prefs = [{"category": "interest", "value": "food", "weight": 2.0}]

    results = recommend([pricey], filters, preferences=prefs)

    assert results == []


# ---------------------------------------------------------------------------
# History / dedup
# ---------------------------------------------------------------------------

def test_recently_visited_excluded_within_window() -> None:
    dest = _dest(id=7, name="BeenThere", region="East Asia")
    # trip ends 2026-04-03; recent visit 2026-03-01 => within 90 days
    history = [{"destination_id": 7, "end_date": "2026-03-01"}]

    results = recommend([dest], _filters(), history=history)

    assert len(results) == 0


def test_old_visit_not_excluded_but_deweighted() -> None:
    visited = _dest(id=7, name="OldTrip", region="East Asia")
    fresh = _dest(id=8, name="Fresh", region="East Asia")
    # visit ended 2025-01-01 => way outside 90-day window
    history = [{"destination_id": 7, "end_date": "2025-01-01"}]

    results = recommend([visited, fresh], _filters(), history=history)
    by_name = {r["destination"]["name"]: r for r in results}

    assert "OldTrip" in by_name  # not excluded
    assert by_name["OldTrip"]["score"] < by_name["Fresh"]["score"]
    assert any("Previously visited" in r for r in by_name["OldTrip"]["reasons"])


def test_history_dedup_reason_present() -> None:
    visited = _dest(id=7, name="OldTrip", region="East Asia")
    history = [{"destination_id": 7, "end_date": "2025-01-01"}]
    results = recommend([visited], _filters(), history=history)
    assert "Previously visited – lower priority" in results[0]["reasons"]


# ---------------------------------------------------------------------------
# Preferences
# ---------------------------------------------------------------------------

def test_preference_tag_boosts_score_and_matchness() -> None:
    food_place = _dest(id=1, name="FoodCity", region="East Asia", tags=["food", "culture"])
    plain_place = _dest(id=2, name="Plain", region="East Asia", tags=["culture"])
    prefs = [{"category": "interest", "value": "food", "weight": 1.0}]

    results = recommend([food_place, plain_place], _filters(), preferences=prefs)
    by_name = {r["destination"]["name"]: r for r in results}

    assert by_name["FoodCity"]["score"] > by_name["Plain"]["score"]
    assert "food" in by_name["FoodCity"]["matched_interests"]
    assert by_name["FoodCity"]["destination"]["tags"] == ["food", "culture"]


def test_preference_weight_dot_product() -> None:
    a = _dest(id=1, name="A", region="East Asia", tags=["food"])
    b = _dest(id=2, name="B", region="East Asia", tags=["culture"])
    prefs = [{"category": "interest", "value": "food", "weight": 2.0}]

    results = recommend([a, b], _filters(), preferences=prefs)
    by_name = {r["destination"]["name"]: r for r in results}

    # a: 2.0*30 + 5 novelty = 65; b: 0 + 5 = 5
    assert by_name["A"]["score"] > by_name["B"]["score"]


# ---------------------------------------------------------------------------
# Season
# ---------------------------------------------------------------------------

def test_season_mismatch_excludes() -> None:
    winter_dest = _dest(id=1, name="WinterLand", region="East Asia", best_season="winter")
    filters = _filters(start_date="2026-04-01", end_date="2026-04-03")  # spring

    results = recommend([winter_dest], filters)

    assert results == []


# ---------------------------------------------------------------------------
# Region filter
# ---------------------------------------------------------------------------

def test_region_filter_hard_excludes() -> None:
    asia = _dest(id=1, name="Asia1", region="East Asia")
    europe = _dest(id=2, name="Europe1", region="Europe", best_season="spring")
    # 9-day trip → Europe is feasible (long trip), region filter separates them
    filters = _filters(start_date="2026-04-01", end_date="2026-04-09", region="Europe")

    results = recommend([asia, europe], filters)

    names = {r["destination"]["name"] for r in results}
    assert names == {"Europe1"}


# ---------------------------------------------------------------------------
# Trip-length fit (nearby for short trips)
# ---------------------------------------------------------------------------

def test_short_trip_only_nearby_regions() -> None:
    nearby = _dest(id=1, name="Local", region="East Asia")
    far = _dest(id=2, name="FarAway", region="Europe", best_season="spring")
    filters = _filters(start_date="2026-04-01", end_date="2026-04-02")  # 2-day

    results = recommend([nearby, far], filters)

    names = {r["destination"]["name"] for r in results}
    assert "Local" in names
    assert "FarAway" not in names


def test_long_trip_allows_far_regions() -> None:
    far = _dest(id=2, name="FarAway", region="Europe", best_season="spring")
    filters = _filters(start_date="2026-04-01", end_date="2026-04-09")  # 9-day

    results = recommend([far], filters)

    assert len(results) == 1
    assert results[0]["destination"]["name"] == "FarAway"


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

def test_same_inputs_same_order() -> None:
    dests = [_dest(id=i, name=f"N{i}", region="East Asia", tags=["culture"]) for i in range(1, 11)]
    filters = _filters()
    history = [{"destination_id": 3, "end_date": "2025-06-01"}]
    prefs = [{"category": "interest", "value": "culture", "weight": 1.0}]

    r1 = recommend(dests, filters, history, prefs)
    r2 = recommend(dests, filters, history, prefs)

    assert [d["destination"]["id"] for d in r1] == [d["destination"]["id"] for d in r2]
    assert [d["score"] for d in r1] == [d["score"] for d in r2]


def test_shuffled_input_still_deterministic_order() -> None:
    dests = [_dest(id=i, name=f"N{i}", region="East Asia", tags=["culture"]) for i in range(1, 6)]
    filters = _filters()

    shuffled = list(dests)
    random.Random(42).shuffle(shuffled)

    r_orig = recommend(dests, filters)
    r_shuf = recommend(shuffled, filters)

    # scores must be identical regardless of input order
    orig_scores = {d["destination"]["id"]: d["score"] for d in r_orig}
    shuf_scores = {d["destination"]["id"]: d["score"] for d in r_shuf}
    assert orig_scores == shuf_scores


# ---------------------------------------------------------------------------
# Output shape
# ---------------------------------------------------------------------------

def test_output_shape_and_reason() -> None:
    results = recommend([_dest()], _filters())
    assert len(results) == 1
    rec = results[0]
    assert set(rec.keys()) == {"destination", "score", "reasons", "matched_interests"}
    assert isinstance(rec["score"], float)
    assert isinstance(rec["reasons"], list)
    assert isinstance(rec["matched_interests"], list)
