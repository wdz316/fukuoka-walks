"""Japanese holiday-length mapping for travel recommendations.

Pure functions – no IO, no DB. This feeds the recommendation engine's
trip-length logic (short/nearby, medium/regional, long/overseas) with the
number of days a traveller can actually take off.

Two public helpers:

* :func:`available_days` – maps a ``start_date`` + ``holiday_type`` to the
  number of available trip days.
* :func:`length_profile` – maps a day count to a trip-length profile
  (``radius`` nearby / regional / overseas and a ``vibe`` hint), matching the
  split the engine already uses to separate near vs. far destinations.

Supported ``holiday_type`` values (see ``docs/openapi.yaml``):

============= =========================================================
``weekend``   2
``three_day`` 3
``obon``      5-7 (contiguous Obon super-free days, mid-August)
``golden_week`` 5-7 (contiguous Golden-Week super-free days, late Apr-early May)
``custom``    N (contiguous weekend + national-holiday days from ``start_date``)
============= =========================================================

Japanese national and substitute holidays for 2025-2027 are embedded below as
data (a pure function has no file/DB dependency).
"""

from __future__ import annotations

from datetime import date, timedelta

# ---------------------------------------------------------------------------
# Japanese national + substitute holidays, 2025-2027
# ---------------------------------------------------------------------------

_JAPAN_HOLIDAYS: dict[int, frozenset[date]] = {
    2025: frozenset({
        date(2025, 1, 1),   # New Year's Day
        date(2025, 1, 13),  # Coming of Age Day
        date(2025, 2, 11),  # National Foundation Day
        date(2025, 2, 23),  # Emperor's Birthday
        date(2025, 2, 24),  # substitute (Emperor's Birthday fell on Sunday)
        date(2025, 3, 20),  # Vernal Equinox Day
        date(2025, 4, 29),  # Showa Day
        date(2025, 5, 3),   # Constitution Memorial Day
        date(2025, 5, 4),   # Greenery Day
        date(2025, 5, 5),   # Children's Day
        date(2025, 5, 6),   # substitute (Greenery Day fell on Sunday)
        date(2025, 7, 21),  # Marine Day
        date(2025, 8, 11),  # Mountain Day
        date(2025, 9, 15),  # Respect for the Aged Day
        date(2025, 9, 23),  # Autumnal Equinox Day
        date(2025, 10, 13),  # Sports Day
        date(2025, 11, 3),  # Culture Day
        date(2025, 11, 23),  # Labor Thanksgiving Day
        date(2025, 11, 24),  # substitute (Labor Thanksgiving fell on Sunday)
    }),
    2026: frozenset({
        date(2026, 1, 1),   # New Year's Day
        date(2026, 1, 12),  # Coming of Age Day
        date(2026, 2, 11),  # National Foundation Day
        date(2026, 2, 23),  # Emperor's Birthday
        date(2026, 3, 20),  # Vernal Equinox Day
        date(2026, 4, 29),  # Showa Day
        date(2026, 5, 3),   # Constitution Memorial Day
        date(2026, 5, 4),   # Greenery Day
        date(2026, 5, 5),   # Children's Day
        date(2026, 5, 6),   # substitute (Constitution Memorial Day was Sunday)
        date(2026, 7, 20),  # Marine Day
        date(2026, 8, 11),  # Mountain Day
        date(2026, 9, 21),  # Respect for the Aged Day
        date(2026, 9, 23),  # Autumnal Equinox Day
        date(2026, 10, 12),  # Sports Day
        date(2026, 11, 3),  # Culture Day
        date(2026, 11, 23),  # Labor Thanksgiving Day
    }),
    2027: frozenset({
        date(2027, 1, 1),   # New Year's Day
        date(2027, 1, 11),  # Coming of Age Day
        date(2027, 2, 11),  # National Foundation Day
        date(2027, 2, 23),  # Emperor's Birthday
        date(2027, 3, 21),  # Vernal Equinox Day
        date(2027, 3, 22),  # substitute (Vernal Equinox Day was Sunday)
        date(2027, 4, 29),  # Showa Day
        date(2027, 5, 3),   # Constitution Memorial Day
        date(2027, 5, 4),   # Greenery Day
        date(2027, 5, 5),   # Children's Day
        date(2027, 7, 19),  # Marine Day
        date(2027, 8, 11),  # Mountain Day
        date(2027, 9, 20),  # Respect for the Aged Day
        date(2027, 9, 23),  # Autumnal Equinox Day
        date(2027, 10, 11),  # Sports Day
        date(2027, 11, 3),  # Culture Day
        date(2027, 11, 23),  # Labor Thanksgiving Day
    }),
}

# Core seasonal days that count as available even though they are not always
# national holidays (they are the days most people actually take off).
_OBON_CORE = (13, 14, 15, 16)  # Aug 13-16

# Canonical windows used to bound seasonal day counts.
_OBON_WINDOW = (8, 11, 8, 17)   # Aug 11 - Aug 17
_GW_WINDOW = (4, 29, 5, 6)      # Apr 29 - May 6

_SUPPORTED_TYPES = ("weekend", "three_day", "obon", "golden_week", "custom", "custom_days")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _holidays(year: int) -> frozenset[date]:
    return _JAPAN_HOLIDAYS.get(year, frozenset())


def _is_official_free(d: date) -> bool:
    """True for weekends and Japanese national/substitute holidays."""
    return d.weekday() >= 5 or d in _holidays(d.year)


def _is_core(d: date, holiday_type: str) -> bool:
    if holiday_type == "obon":
        return d.month == 8 and d.day in _OBON_CORE
    if holiday_type == "golden_week":
        return (d.month == 4 and d.day == 29) or (d.month == 5 and d.day in (3, 4, 5))
    return False


def _window(holiday_type: str) -> tuple[date, date]:
    if holiday_type == "obon":
        sm, sd, em, ed = _OBON_WINDOW
    else:  # golden_week
        sm, sd, em, ed = _GW_WINDOW
    return date(2000, sm, sd), date(2000, em, ed)


def _season_block(year: int, holiday_type: str) -> int:
    """Number of available days inside the canonical seasonal window.

    A day counts as available if it is a weekend, a national/substitute
    holiday, or a core seasonal day (Obon Aug 13-16 / Golden Week).
    """
    win_start, win_end = _window(holiday_type)
    start = date(year, win_start.month, win_start.day)
    end = date(year, win_end.month, win_end.day)
    total = 0
    d = start
    while d <= end:
        if _is_official_free(d) or _is_core(d, holiday_type):
            total += 1
        d += timedelta(days=1)
    return total


def _custom_days(start: date) -> int:
    """Contiguous streak of weekend + holiday days starting at ``start``."""
    count = 0
    d = start
    while _is_official_free(d):
        count += 1
        d += timedelta(days=1)
    return count


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def available_days(start_date: str, holiday_type: str) -> int:
    """Return the number of available trip days for a holiday type at/after
    ``start_date`` (ISO ``YYYY-MM-DD``).

    * ``weekend`` -> 2
    * ``three_day`` -> 3
    * ``obon`` / ``golden_week`` -> 5-7 (seasonal block for that year)
    * ``custom`` / ``custom_days`` -> N (contiguous free days from start)
    """
    if holiday_type not in _SUPPORTED_TYPES:
        raise ValueError(f"unsupported holiday_type: {holiday_type!r}")

    if holiday_type == "weekend":
        return 2
    if holiday_type == "three_day":
        return 3
    if holiday_type in ("obon", "golden_week"):
        return _season_block(date.fromisoformat(start_date).year, holiday_type)
    # custom / custom_days
    return _custom_days(date.fromisoformat(start_date))


def length_profile(days: int) -> dict[str, str]:
    """Map a trip length (days) to a travel profile.

    * ``2``        -> ``nearby`` (近郊), ``city/nature`` vibe
    * ``3``-``4``  -> ``regional`` (地域周遊)
    * ``5``+       -> ``overseas`` (海外・長距離)

    Mirrors the engine's short / medium / long trip split so the day count can
    feed the recommendation distance logic.
    """
    if days <= 2:
        return {"radius": "nearby", "vibe": "city/nature"}
    if days <= 4:
        return {"radius": "regional", "vibe": "city/nature"}
    return {"radius": "overseas", "vibe": "long-haul"}
