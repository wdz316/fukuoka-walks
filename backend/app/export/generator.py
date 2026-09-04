"""Generate a self-contained single-file HTML itinerary for a trip.

Pure functions only: no database access, no network calls, no I/O. The
returned HTML embeds all CSS and JS inline so the page renders correctly when
opened from a local file (offline) or shared through social media / messaging.

Everything the JavaScript needs (countdown epoch etc.) is injected inline as
JSON so the page works with the file saved to disk.
"""

from __future__ import annotations

import html
import json
from datetime import date, datetime, time, timedelta, timezone

LEAFLET_CSS = (
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
)
LEAFLET_JS = (
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
)


def _fmt_date(value: date | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d")


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def _epoch_start(end_date: date | None) -> int:
    """Epoch (ms) for the moment the countdown reaches zero."""
    if end_date is None:
        return 0
    start = datetime.combine(end_date, time.min, tzinfo=timezone.utc)
    return int(start.timestamp() * 1000)


def _booking_urls(destination) -> dict:
    """Return dicts of booking URLs per category (transport/hotels/attractions)."""
    name = ""
    lat = lng = None
    if destination is not None:
        name = getattr(destination, "name", "") or ""
        lat = getattr(destination, "lat", None)
        lng = getattr(destination, "lng", None)

    q = _esc(name or "日本")

    transport = [
        "https://www.google.com/maps/dir/?api=1&destination=" + q,
        "https://www.japan-rail-pass.com/buy-online",
    ]
    hotels = [
        "https://www.booking.com/searchresults.html?ss=" + q,
        "https://hoshinoresorts.com/",
        "https://www.jalan.net/",
        "https://travel.rakuten.co.jp/",
    ]
    attractions = [
        "https://www.google.com/maps/search/" + q,
    ]
    if lat is not None and lng is not None:
        attractions.append(
            "https://www.google.com/maps/search/?api=1&query=%f,%f" % (lat, lng)
        )

    return {
        "transport": transport,
        "hotels": hotels,
        "attractions": attractions,
    }


def _anchor_list(items: list, label: str) -> str:
    """Render one booking-link anchor group (a <ul> of <a class="btn">)."""
    lis = "\n".join(
        '<li><a class="btn" href="%s" target="_blank" rel="noopener">%s</a></li>'
        % (_esc(url), _esc(label))
        for url in items
    )
    return '<ul>%s</ul>' % lis


def _day_list(base: date | None, days: int) -> list[date | None]:
    """Expand ``base`` into ``days`` consecutive dates (None-padded if absent)."""
    if base is None:
        return [None] * days
    return [base + timedelta(days=i) for i in range(days)]


def _timeline(trip, destination) -> str:
    """Render the vertical day-by-day timeline (Day1..DayN).

    Each day is one timeline item containing 上午交通 / 下午景點 / 晚上酒店
    cards in that default order (no real per-point timing data is available).
    """
    start = getattr(trip, "start_date", None)
    end = getattr(trip, "end_date", None)

    num_days = 1
    if isinstance(start, date) and isinstance(end, date):
        try:
            num_days = max(1, (end - start).days + 1)
        except TypeError:
            num_days = 1

    days = _day_list(start if isinstance(start, date) else None, num_days)
    urls = _booking_urls(destination)

    items = []
    for idx, day in enumerate(days, start=1):
        date_line = _esc(_fmt_date(day)) if day is not None else ""
        items.append(
            '<section class="tl-item">'
            '<span class="tl-dot"></span>'
            '<header class="tl-day"><h2>Day %d</h2><span class="tl-date">%s</span></header>'
            '<div class="tl-body">'
            '<div class="tl-card trans"><h3>上午交通 (Morning Transport)</h3>%s</div>'
            '<div class="tl-card sights"><h3>下午景點 (Afternoon Attractions)</h3>%s</div>'
            '<div class="tl-card hotel"><h3>晚上酒店 (Evening Hotel)</h3>%s</div>'
            "</div></section>"
            % (
                idx,
                date_line,
                _anchor_list(urls["transport"], "交通 (Transport)"),
                _anchor_list(urls["attractions"], "景點 (Attractions)"),
                _anchor_list(urls["hotels"], "住宿 (Hotel)"),
            )
        )

    return (
        '<section class="card timeline">'
        "<h2>行程時間線 (Itinerary Timeline)</h2>"
        + "".join(items)
        + "</section>"
    )


def _map_section(destination) -> str:
    lat = getattr(destination, "lat", None) if destination is not None else None
    lng = getattr(destination, "lng", None) if destination is not None else None
    name = getattr(destination, "name", "Destination") if destination is not None else "Destination"
    if lat is None or lng is None:
        # Offline/no-coordinate fallback: keep a styled placeholder so layout
        # stays intact even when tiles cannot load.
        return (
            '<section class="card map"><h2>地圖 (Map)</h2>'
            '<div id="map" class="map-canvas"><p class="map-fallback">'
            "地圖加載中 / Map loading…</p></div></section>"
        )
    return (
        '<section class="card map"><h2>地圖 (Map)</h2>'
        '<div id="map" class="map-canvas"></div></section>'
    ) + "<script>window.__MAP_POINT__=" + json.dumps(
        {"lat": lat, "lng": lng, "name": name}
    ) + ";</script>"


def _render_countdown_script(end_date: date | None) -> str:
    epoch = _epoch_start(end_date)
    return (
        "<script>\n"
        "window.addEventListener('DOMContentLoaded', function () {\n"
        "  var end = %d;\n"
        "  var el = document.getElementById('countdown');\n"
        "  if (!el) return;\n"
        "  function pad(n) { return n < 10 ? '0' + n : '' + n; }\n"
        "  function tick() {\n"
        "    var diff = end - Date.now();\n"
        "    if (diff < 0) { el.textContent = '旅程開始了！Trip started!'; return; }\n"
        "    var s = Math.floor(diff / 1000);\n"
        "    var d = Math.floor(s / 86400); s -= d * 86400;\n"
        "    var h = Math.floor(s / 3600); s -= h * 3600;\n"
        "    var m = Math.floor(s / 60); s -= m * 60;\n"
        "    el.textContent = d + ' 天 ' + pad(h) + ':' + pad(m) + ':' + pad(s);\n"
        "  }\n"
        "  tick();\n"
        "  setInterval(tick, 1000);\n"
        "});\n"
        "</script>"
    ) % epoch


def _init_map_script() -> str:
    return (
        "<script>\n"
        "window.addEventListener('DOMContentLoaded', function () {\n"
        "  var point = window.__MAP_POINT__;\n"
        "  var el = document.getElementById('map');\n"
        "  if (!el || typeof L === 'undefined' || !point) return;\n"
        "  var map = L.map(el).setView([point.lat, point.lng], 12);\n"
        "  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n"
        "    maxZoom: 19,\n"
        "    attribution: '&copy; OpenStreetMap contributors'\n"
        "  }).addTo(map);\n"
        "  L.marker([point.lat, point.lng]).addTo(map)\n"
        "    .bindPopup('<b>' + point.name + '</b>').openPopup();\n"
        "});\n"
        "</script>"
    )


def render_trip_html(trip, destination=None, next_trip=None) -> str:
    """Render ``trip`` as a self-contained HTML document string.

    ``trip``/``destination``/``next_trip`` may be ORM models or simple
    attribute-holding objects. `destination` supplies coordinates and booking
    labels; `next_trip` (optional) renders an upcoming-trip teaser.
    """
    title = getattr(trip, "title", "My Trip") or "My Trip"
    start = getattr(trip, "start_date", None)
    end = getattr(trip, "end_date", None)
    budget = getattr(trip, "budget", None)
    notes = getattr(trip, "notes", None) or ""
    comment = getattr(trip, "comment", None) or ""

    dest_name = ""
    if destination is not None:
        dest_name = getattr(destination, "name", "") or ""

    og_title = f"{title} | {dest_name}" if dest_name else title
    esc_title = _esc(og_title)

    next_block = ""
    if next_trip is not None:
        nt_title = getattr(next_trip, "title", None) or ""
        nt_start = getattr(next_trip, "start_date", None)
        if nt_title:
            next_block = (
                '<section class="card next"><h2>下次旅程 (Next Trip)</h2>'
                "<p>%s — %s</p></section>"
                % (
                    _esc(nt_title),
                    _esc(_fmt_date(nt_start)),
                )
            )

    duration = ""
    if start and end:
        try:
            duration = f"{(end - start).days + 1} 天"
        except TypeError:
            duration = ""

    budget_html = ""
    if budget is not None:
        budget_html = "<p class='budget'>預算 Budget: ¥%s</p>" % _esc(
            f"{int(budget):,}"
        )

    point_lat = getattr(destination, "lat", None) if destination is not None else None
    point_lng = getattr(destination, "lng", None) if destination is not None else None
    map_init_script = _init_map_script() if point_lat is not None and point_lng is not None else ""

    notes_html = ""
    if notes:
        notes_html = "<p class='notes'>%s</p>" % _esc(notes)
    comment_html = ""
    if comment:
        comment_html = "<p class='comment'>%s</p>" % _esc(comment)

    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc_title}</title>
<meta name="description" content="{esc_title} — 旅程分享">
<meta property="og:title" content="{esc_title}">
<meta property="og:description" content="{esc_title} — 旅程分享">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc_title}">
<meta name="twitter:description" content="{esc_title} — 旅程分享">
<link rel="stylesheet" href="{LEAFLET_CSS}">
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Hiragino Kaku Gothic ProN", "Noto Sans", sans-serif;
    background: #f4f6f8; color: #1f2937; line-height: 1.6;
  }}
  .wrap {{ max-width: 720px; margin: 0 auto; padding: 16px; }}
  header.hero {{
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: #fff; border-radius: 16px; padding: 24px; margin-bottom: 16px;
  }}
  header.hero h1 {{ margin: 0 0 8px; font-size: 1.6rem; }}
  header.hero .sub {{ opacity: .9; }}
  #countdown {{
    font-size: 1.9rem; font-weight: 700; margin-top: 16px;
    font-variant-numeric: tabular-nums;
  }}
  .card {{
    background: #fff; border-radius: 16px; padding: 20px;
    margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }}
  .card h2 {{ margin-top: 0; font-size: 1.15rem; }}
  .links ul {{ list-style: none; padding: 0; margin: 0; }}
  .links li {{ margin-bottom: 8px; }}
  .btn {{
    display: block; text-align: center; padding: 12px; border-radius: 10px;
    background: #eef2ff; color: #2563eb; font-weight: 600;
    text-decoration: none; border: 1px solid #c7d2fe;
  }}
  .btn:hover {{ background: #e0e7ff; }}
  .map-canvas {{ height: 320px; border-radius: 12px; }}
  .map-fallback {{ color: #6b7280; text-align: center; padding-top: 130px; }}
  .budget {{ color: #047857; font-weight: 600; }}
  .notes, .comment {{ color: #374151; }}
  .next {{ background: #ecfeff; border: 1px solid #a5f3fc; }}
  .timeline {{ position: relative; padding-left: 44px; }}
  .timeline::before {{
    content: ""; position: absolute; left: 16px; top: 6px; bottom: 6px;
    width: 4px; border-radius: 4px; background: #e0e7ff; margin-left: -2px;
  }}
  .tl-item {{ position: relative; margin-bottom: 22px; }}
  .tl-item:last-child {{ margin-bottom: 0; }}
  .tl-dot {{
    position: absolute; left: 9px; top: 10px; width: 14px; height: 14px;
    border-radius: 50%; background: #2563eb; border: 3px solid #fff;
    box-shadow: 0 0 0 2px #2563eb;
  }}
  .tl-day {{ display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }}
  .tl-day h2 {{ margin: 0; font-size: 1.2rem; color: #2563eb; }}
  .tl-date {{ color: #6b7280; font-size: .9rem; }}
  .tl-body {{ display: grid; gap: 10px; }}
  .tl-card {{
    background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px;
    padding: 12px 14px;
  }}
  .tl-card h3 {{ margin: 0 0 8px; font-size: .9rem; color: #374151; }}
  .tl-card ul {{ list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>{_esc(title)}</h1>
    <div class="sub">{_esc(dest_name)}{' · ' + duration if duration else ''}</div>
    <div class="sub">{_esc(_fmt_date(start))} → {_esc(_fmt_date(end))}</div>
    {budget_html}
    <div id="countdown">—</div>
  </header>

  {_map_section(destination)}

  {comment_html}
  {notes_html}

  {_timeline(trip, destination)}

  {next_block}
</div>
{_render_countdown_script(end)}
{map_init_script}
</body>
</html>
"""
