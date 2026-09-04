"""Tests for the single-file HTML itinerary generator (pure functions)."""

from datetime import date

from app.export.generator import (
    _epoch_start,
    _esc,
    render_trip_html,
)


class _Trip:
    def __init__(
        self,
        title="Tokyo Spring Trip",
        start_date=date(2026, 3, 20),
        end_date=date(2026, 3, 27),
        budget=200000,
        notes="Skytree + Asakusa",
        comment="Let's go!",
    ):
        self.title = title
        self.start_date = start_date
        self.end_date = end_date
        self.budget = budget
        self.notes = notes
        self.comment = comment


class _Destination:
    def __init__(
        self,
        name="Tokyo",
        lat=35.6762,
        lng=139.6503,
    ):
        self.name = name
        self.lat = lat
        self.lng = lng


class _Next:
    def __init__(self, title="Kyoto Autumn", start_date=date(2026, 11, 1)):
        self.title = title
        self.start_date = start_date


def test_render_is_self_contained_html_document():
    html = render_trip_html(_Trip())
    assert html.startswith("<!DOCTYPE html>")
    assert "<html" in html and "</html>" in html
    assert "<head>" in html and "</head>" in html
    assert "<body>" in html and "</body>" in html


def test_render_includes_og_and_twitter_meta_tags():
    html = render_trip_html(_Trip(), _Destination())
    assert 'property="og:title"' in html
    assert 'property="og:description"' in html
    assert 'property="og:type"' in html
    assert 'name="twitter:card"' in html
    assert 'name="twitter:title"' in html
    assert 'name="twitter:description"' in html
    assert "<title>Tokyo Spring Trip | Tokyo</title>" in html


def test_render_includes_countdown_script_and_title():
    html = render_trip_html(_Trip())
    assert "countdown" in html
    assert "setInterval" in html
    assert "Date.now()" in html
    assert "days" in html or "天" in html
    # epoch matches end date
    assert str(_epoch_start(date(2026, 3, 27))) in html


def test_render_includes_three_booking_link_anchor_groups():
    html = render_trip_html(_Trip(), _Destination())
    assert "交通" in html and "/maps/dir" in html
    assert "住宿" in html and "booking.com" in html
    assert "景點" in html
    # all three catalogues appear as anchors
    for marker in ("google.com", "booking.com", "jalan.net", "rakuten.co.jp"):
        assert marker in html


def test_render_includes_leaflet_map_when_coordinates_present():
    html = render_trip_html(_Trip(), _Destination(lat=35.6762, lng=139.6503))
    assert "leaflet" in html
    assert "__MAP_POINT__" in html
    assert "35.6762" in html


def test_render_map_placeholder_when_no_coordinates():
    html = render_trip_html(_Trip(), _Destination(lat=None, lng=None))
    assert "map-fallback" in html
    assert "__MAP_POINT__" not in html


def test_render_next_trip_teaser_when_provided():
    html = render_trip_html(_Trip(), _Destination(), next_trip=_Next())
    assert "Kyoto Autumn" in html
    assert "2026-11-01" in html
    assert "下次旅程" in html


def test_render_omits_next_trip_when_not_provided():
    html = render_trip_html(_Trip(), _Destination())
    assert "下次旅程" not in html


def test_render_escapes_html_in_user_fields():
    trip = _Trip(title="<script>alert('x')</script>", notes="<b>bold</b>")
    html = render_trip_html(trip, _Destination())
    assert "<script>alert('x')</script>" not in html
    assert "&lt;script&gt;" in html


def test_render_includes_budget_and_dates():
    html = render_trip_html(_Trip(), _Destination())
    assert "200,000" in html
    assert "2026-03-20" in html
    assert "2026-03-27" in html
    assert "8 天" in html


def test_epoch_start_is_midnight_utc_of_end_date():
    assert _epoch_start(date(2026, 3, 27)) == 1774569600000
