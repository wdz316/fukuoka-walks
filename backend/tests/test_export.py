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
        attractions=None,
        hotels=None,
    ):
        self.name = name
        self.lat = lat
        self.lng = lng
        self.attractions = attractions or []
        self.hotels = hotels or []


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


def test_render_timeline_has_day_sections_matching_days():
    trip = _Trip(start_date=date(2026, 3, 20), end_date=date(2026, 3, 27))
    html = render_trip_html(trip, _Destination())
    num_days = (date(2026, 3, 27) - date(2026, 3, 20)).days + 1
    # one timeline item per day
    assert html.count('class="tl-item"') == num_days
    assert "行程時間線" in html
    assert "Day 1" in html and f"Day {num_days}" in html
    assert "Day 1" in html and html.index("Day 1") < html.index("Day 2")


def test_render_timeline_each_day_has_transport_sights_hotel():
    html = render_trip_html(_Trip(), _Destination())
    # default order within each day: morning transport / afternoon sights / evening hotel
    morning = html.index("上午交通")
    afternoon = html.index("下午景點")
    evening = html.index("晚上酒店")
    assert morning < afternoon < evening
    assert html.count("上午交通") >= 1
    assert html.count("下午景點") >= 1
    assert html.count("晚上酒店") >= 1


def test_render_includes_leaflet_map_when_coordinates_present():
    html = render_trip_html(_Trip(), _Destination(lat=35.6762, lng=139.6503))
    assert "leaflet" in html
    assert "__MAP_POINTS__" in html
    assert "35.6762" in html


def test_render_head_loads_both_leaflet_css_and_js():
    html = render_trip_html(_Trip(), _Destination())
    css_idx = html.index('<link rel="stylesheet"')
    js_idx = html.index('<script src="')
    assert 'rel="stylesheet"' in html
    assert "leaflet.css" in html
    assert '<script src="' + "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" + '"></script>' in html
    assert "leaflet.js" in html
    head = html[html.index("<head>"): html.index("</head>")]
    assert "leaflet.js" in head
    assert js_idx > css_idx


def test_render_init_map_degrades_to_points_list_when_leaflet_missing():
    dest = _Destination(
        attractions=[
            {"name": "Skytree", "lat": 35.7100, "lng": 139.8107, "day": 1},
            {"name": "Asakusa", "lat": 35.7148, "lng": 139.7967, "day": 2},
        ],
        hotels=[{"name": "Shinjuku Hotel", "lat": 35.6938, "lng": 139.7034, "day": 1}],
    )
    html = render_trip_html(_Trip(), dest)
    assert "typeof L === 'undefined'" in html
    assert "__MAP_POINTS__" in html
    # the JS builds the textual degradation list (Day + name), never blank
    assert "'Day ' + p.day" in html
    assert "p.name" in html
    assert "map-list-item" in html
    assert "地圖無法載入" in html


def test_render_map_placeholder_when_no_coordinates():
    html = render_trip_html(_Trip(), _Destination(lat=None, lng=None))
    assert "map-fallback" in html
    assert "__MAP_POINTS__" not in html


def test_render_map_has_multiple_markers_and_polyline():
    dest = _Destination(
        attractions=[
            {"name": "Skytree", "lat": 35.7100, "lng": 139.8107, "day": 1,
             "url": "https://www.tokyo-skytree.jp/", "phone": "03-5302-0000"},
            {"name": "Asakusa", "lat": 35.7148, "lng": 139.7967, "day": 1},
        ],
        hotels=[
            {"name": "Shinjuku Hotel", "lat": 35.6938, "lng": 139.7034, "day": 1},
        ],
    )
    html = render_trip_html(_Trip(), dest)
    assert "__MAP_POINTS__" in html
    assert "Skytree" in html
    assert "Asakusa" in html
    assert "Shinjuku Hotel" in html
    assert "L.marker" in html
    assert "L.polyline" in html
    assert "fitBounds" in html


def test_render_timeline_shows_website_booking_phone_for_points():
    dest = _Destination(
        attractions=[
            {"name": "清水寺", "lat": 34.9949, "lng": 135.7850, "day": 1,
             "url": "https://www.kiyomizudera.or.jp/",
             "booking_url": "https://www.kiyomizudera.or.jp/ticket",
             "phone": "075-551-1234", "address": "京都市東山区清水1丁目294"},
        ],
        hotels=[
            {"name": "祇園旅館", "lat": 35.0036, "lng": 135.7753, "day": 1,
             "url": "https://www.booking.com/searchresults.html?ss=Gion",
             "booking_url": "https://www.booking.com/searchresults.html?ss=Gion",
             "phone": "+81-75-XXX-XXXX", "address": "京都市東山区祇園町"},
        ],
    )
    trip = _Trip(start_date=date(2026, 3, 20), end_date=date(2026, 3, 21))
    html = render_trip_html(trip, dest)
    # official website links present in detail cards
    assert "kiyomizudera.or.jp" in html
    assert "https://www.kiyomizudera.or.jp/" in html
    assert "booking.com" in html
    # booking button rendered
    assert "預約" in html
    assert "預訂房" in html
    # phone + address rendered
    assert "075-551-1234" in html
    assert "京都市東山区清水1丁目294" in html
    assert "祇園町" in html


def test_render_map_popup_contains_official_website_link():
    dest = _Destination(
        attractions=[
            {"name": "金閣寺", "lat": 35.0394, "lng": 135.7292, "day": 2,
             "url": "https://www.shokoku-ji.jp/kinkaku/"},
        ],
    )
    html = render_trip_html(_Trip(), dest)
    assert "shokoku-ji.jp" in html
    assert "popupHtml" in html
    assert "https://www.shokoku-ji.jp/kinkaku/" in html


def test_render_shows_station_info_in_popup_and_timeline():
    dest = _Destination(
        attractions=[
            {"name": "櫛田神社", "lat": 33.5957, "lng": 130.4146, "day": 1,
             "station": {"name": "祇園駅", "line": "地下鉄空港線"}},
        ],
    )
    trip = _Trip(start_date=date(2026, 9, 6), end_date=date(2026, 9, 6))
    html = render_trip_html(trip, dest)
    assert "祇園駅" in html
    assert "地下鉄空港線" in html


def test_render_map_single_point_no_polyline():
    dest = _Destination(
        attractions=[{"name": "Tokyo Tower", "lat": 35.6586, "lng": 139.7454, "day": 1}],
    )
    html = render_trip_html(_Trip(), dest)
    assert "__MAP_POINTS__" in html
    assert "L.marker" in html
    assert "fitBounds" in html


def test_render_map_fallback_when_no_attractions_or_hotels():
    dest = _Destination(lat=35.6762, lng=139.6503, attractions=[], hotels=[])
    html = render_trip_html(_Trip(), dest)
    assert "__MAP_POINTS__" in html
    assert "35.6762" in html


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
