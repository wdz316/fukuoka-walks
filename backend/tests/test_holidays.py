"""Tests for the Japanese holiday-length mapping helpers."""

import pytest

from app.reco.holidays import available_days, length_profile


# ---------------------------------------------------------------------------
# available_days: fixed-length types
# ---------------------------------------------------------------------------

def test_weekend_is_two_days() -> None:
    assert available_days("2026-05-09", "weekend") == 2


def test_three_day_is_three_days() -> None:
    assert available_days("2026-05-09", "three_day") == 3


# ---------------------------------------------------------------------------
# available_days: Obon (mid-August, 5-7 days)
# ---------------------------------------------------------------------------

def test_obon_2025() -> None:
    days = available_days("2025-08-13", "obon")
    assert 5 <= days <= 7


def test_obon_2026() -> None:
    days = available_days("2026-08-13", "obon")
    assert 5 <= days <= 7


def test_obon_2027() -> None:
    days = available_days("2027-08-13", "obon")
    assert 5 <= days <= 7


def test_obon_always_at_least_five() -> None:
    for year in (2025, 2026, 2027):
        assert available_days(f"{year}-08-13", "obon") >= 5


# ---------------------------------------------------------------------------
# available_days: Golden Week (late Apr - early May, 5-7 days)
# ---------------------------------------------------------------------------

def test_golden_week_2025() -> None:
    days = available_days("2025-04-29", "golden_week")
    assert 5 <= days <= 7


def test_golden_week_2026() -> None:
    days = available_days("2026-05-03", "golden_week")
    assert 5 <= days <= 7


def test_golden_week_2027() -> None:
    days = available_days("2027-05-03", "golden_week")
    assert 5 <= days <= 7


# ---------------------------------------------------------------------------
# available_days: custom (contiguous free days)
# ---------------------------------------------------------------------------

def test_custom_weekend_streak() -> None:
    # 2026-05-09 is a Saturday -> Sat + Sun = 2 contiguous days
    assert available_days("2026-05-09", "custom") == 2


def test_custom_alias_custom_days() -> None:
    assert available_days("2026-05-09", "custom_days") == 2


def test_custom_weekday_starts_at_zero() -> None:
    assert available_days("2026-05-08", "custom") == 0


# ---------------------------------------------------------------------------
# available_days: invalid input
# ---------------------------------------------------------------------------

def test_unknown_holiday_type_raises() -> None:
    with pytest.raises(ValueError):
        available_days("2026-05-09", "golden_weekend")


# ---------------------------------------------------------------------------
# length_profile
# ---------------------------------------------------------------------------

def test_profile_nearby() -> None:
    assert length_profile(2) == {"radius": "nearby", "vibe": "city/nature"}


def test_profile_regional() -> None:
    assert length_profile(3) == {"radius": "regional", "vibe": "city/nature"}
    assert length_profile(4) == {"radius": "regional", "vibe": "city/nature"}


def test_profile_overseas() -> None:
    assert length_profile(5)["radius"] == "overseas"
    assert length_profile(7)["radius"] == "overseas"
    assert length_profile(7)["vibe"] == "long-haul"


def test_profile_bounds() -> None:
    assert length_profile(1)["radius"] == "nearby"
    assert length_profile(2)["radius"] == "nearby"
    assert length_profile(5)["radius"] == "overseas"


def test_profile_shape() -> None:
    prof = length_profile(2)
    assert set(prof.keys()) == {"radius", "vibe"}
