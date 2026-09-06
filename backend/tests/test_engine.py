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
# Budget (soft – never hard-excludes)
# ---------------------------------------------------------------------------

def test_budget_overage_kept_but_ranked_lower() -> None:
    """Over-budget destinations stay (soft ranking), ranked below in-budget."""
    expensive = _dest(id=1, name="Lux", cost_level_1=10, cost_level_2=10)
    cheap = _dest(id=2, name="Budget", cost_level_1=1, cost_level_2=1)
    # 3-day trip → uses cost_level_2 (days <= 4)
    # cheap(1) => 1*20k*3 = 60k (within); expensive(10) => 600k (over)
    filters = _filters(budget=300_000)

    results = recommend([expensive, cheap], filters)
    by_name = {r["destination"]["name"]: r for r in results}

    # neither is dropped, but the in-budget one wins and is not flagged
    assert "Lux" in by_name
    assert "Budget" in by_name
    assert by_name["Budget"]["score"] > by_name["Lux"]["score"]
    assert any("予算内" in r for r in by_name["Budget"]["reasons"])
    assert any("を超過" in r for r in by_name["Lux"]["reasons"])


def test_budget_empty_keeps_all() -> None:
    results = recommend(
        [_dest(id=1, name="A", cost_level_1=10)],
        _filters(),
    )
    assert len(results) == 1


def test_budget_none_explicit_keeps_all() -> None:
    filters = _filters(budget=None)
    results = recommend(
        [_dest(id=1, name="A", cost_level_1=10)],
        filters,
    )
    assert len(results) == 1


def test_small_budget_never_empty_keeps_cheapest() -> None:
    """A tiny budget must not wipe out results – cheapest option still returns."""
    dests = [
        _dest(id=1, name="Budget", cost_level_1=1, cost_level_2=1),
        _dest(id=2, name="Pricey", cost_level_1=10, cost_level_2=10),
    ]
    # 3-day trip → cost_level_2; even the cheapest (1*20k*3 = 60k) is over 10k
    filters = _filters(budget=10_000, interests=["food"])
    prefs = [{"category": "interest", "value": "food", "weight": 2.0}]

    results = recommend(dests, filters, preferences=prefs)

    names = [r["destination"]["name"] for r in results]
    # not emptied on a tight budget – both cheapest and pricey stay visible
    assert "Budget" in names
    assert "Pricey" in names
    all_reasons = [reason for r in results for reason in r["reasons"]]
    assert any("を超過" in reason for reason in all_reasons)


def test_small_budget_cheapest_beats_expensive_ranking() -> None:
    """Within-budget cheap option ranks above over-budget expensive option."""
    cheap = _dest(id=1, name="Cheap", cost_level_1=1, cost_level_2=1)
    pricey = _dest(id=2, name="Pricey", cost_level_1=10, cost_level_2=10)
    # 3-day trip → cost_level_2; cheap = 1*20k*3 = 60k (under 100k budget)
    #                              pricey = 10*20k*3 = 600k (over 100k budget)
    filters = _filters(budget=100_000)

    results = recommend([cheap, pricey], filters)
    by_name = {r["destination"]["name"]: r for r in results}

    assert len(results) == 2  # nothing hard-excluded
    assert by_name["Cheap"]["score"] > by_name["Pricey"]["score"]
    assert any("予算内" in reason for reason in by_name["Cheap"]["reasons"])
    assert any("を超過" in reason for reason in by_name["Pricey"]["reasons"])


def test_small_budget_all_over_cost_still_retains_cheapest_three() -> None:
    """Even when every destination exceeds a tiny budget, the cheapest 3+ are present.

    Budget is soft (never hard-excludes), so all destinations survive ranking.
    The test locks the invariant that a small budget does not wipe results to
    fewer than 3 cheapest candidates.
    """
    dests = [
        _dest(id=i, name=f"T{v}", cost_level_1=v, cost_level_2=v)
        for i, v in enumerate([1, 2, 3, 7, 8, 9], start=1)
    ]
    # 3-day trip → cost_level_2; cheapest = 1*20k*3 = 60k, budget = 10k → all over
    filters = _filters(budget=10_000)

    results = recommend(dests, filters)

    names = {r["destination"]["name"] for r in results}
    assert {"T1", "T2", "T3"} <= names  # cheapest 3 always present
    assert len(results) == len(dests)   # no hard-cuts at all


# ---------------------------------------------------------------------------
# Same-city weekend (市内散策 / staycation)
# ---------------------------------------------------------------------------

def test_weekend_same_city_recommended_any_season() -> None:
    """A same-city weekend must always be recommendable, even off-season.

    Uses a Chinese-language origin (福冈) that maps to the romaji destination
    (Fukuoka, best season autumn) and a winter weekend – previously excluded by
    the season hard filter, now restored by the 市内散策 exemption.
    """
    fukuoka = _dest(
        id=1,
        name="Fukuoka",
        country="Japan",
        region="East Asia",
        best_season="autumn",
    )
    # winter weekend – opposite of Fukuoka's best season
    filters = _filters(
        start_date="2026-01-10",
        end_date="2026-01-11",
        origin="福冈",
    )

    results = recommend([fukuoka], filters)

    assert len(results) == 1
    assert results[0]["destination"]["name"] == "Fukuoka"
    assert any("市内散策" in r for r in results[0]["reasons"])


def test_cjk_origin_matches_romaji_destination() -> None:
    """Romaji/Japanese/Chinese spellings of the same city are all matched."""
    tokyo = _dest(id=1, name="Tokyo", country="Japan")

    for origin in ("Tokyo", "東京", "东京"):
        results = recommend([tokyo], _filters(origin=origin))
        assert len(results) == 1, f"origin {origin!r} should match Tokyo"
        assert any("市内散策" in r for r in results[0]["reasons"])


def test_same_city_weekend_outranks_nearby_other() -> None:
    """On a short trip the traveller's own city wins the 市内散策 boost."""
    home = _dest(id=1, name="Fukuoka", country="Japan", region="East Asia", best_season="spring")
    other = _dest(id=2, name="Seoul", country="South Korea", region="East Asia", best_season="spring")
    # spring weekend in Fukuoka's season
    filters = _filters(start_date="2026-04-04", end_date="2026-04-05", origin="福冈")

    results = recommend([other, home], filters)
    by_name = {r["destination"]["name"]: r for r in results}

    assert by_name["Fukuoka"]["score"] > by_name["Seoul"]["score"]
    assert any("市内散策" in r for r in by_name["Fukuoka"]["reasons"])


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
    assert any("訪問済み" in r for r in by_name["OldTrip"]["reasons"])


def test_history_dedup_reason_present() -> None:
    visited = _dest(id=7, name="OldTrip", region="East Asia")
    history = [{"destination_id": 7, "end_date": "2025-01-01"}]
    results = recommend([visited], _filters(), history=history)
    assert "訪問済み——優先度低" in results[0]["reasons"]


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


# ---------------------------------------------------------------------------
# Raw catalogue rows (seed JSON shape: extra keys, no id)
# ---------------------------------------------------------------------------

def test_raw_seed_rows_with_extra_keys_and_missing_id() -> None:
    raw = {
        "name": "Fukuoka",
        "country": "Japan",
        "region": "East Asia",
        "description": "yatai stalls",
        "best_season": "autumn",
        "lat": 33.5904,
        "lng": 130.4017,
        "image_url": "https://example.com/fukuoka.jpg",
        "tags": ["food"],
        "cost_level_1": 5,
        "cost_level_2": 4,
        "cost_level_3": 3,
        "cost_level_4": 2,
    }
    results = recommend(
        [raw],
        {"start_date": "2026-09-05", "end_date": "2026-09-06", "origin": "福冈"},
    )
    assert len(results) == 1
    assert results[0]["destination"]["name"] == "Fukuoka"
