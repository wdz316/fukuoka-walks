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


def _timeline_day_detail(day_num: int, attractions: list, hotels: list) -> str:
    """Render per-point detail cards for a single day (attractions + hotels)."""
    day_attractions = [a for a in attractions if a.get("day") == day_num]
    day_hotels = [h for h in hotels if h.get("day") == day_num]

    parts = []

    if day_attractions:
        for a in day_attractions:
            url = a.get("url") or ""
            booking_url = a.get("booking_url") or ""
            phone = a.get("phone") or ""
            address = a.get("address") or ""
            detail_rows = ""
            if address:
                detail_rows += '<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-text">%s</span></div>' % _esc(address)
            station = a.get("station") or {}
            if isinstance(station, dict) and station.get("name"):
                detail_rows += '<div class="detail-row"><span class="detail-icon">🚇</span><span class="detail-text">%s（%s）</span></div>' % (_esc(station.get("name")), _esc(station.get("line")))
            if phone:
                detail_rows += '<div class="detail-row"><span class="detail-icon">📞</span><span class="detail-text"><a href="tel:%s">%s</a></span></div>' % (_esc(phone), _esc(phone))
            btns = ""
            if url:
                btns += '<a class="btn-detail" href="%s" target="_blank" rel="noopener">🌐 官網</a>' % _esc(url)
            if booking_url:
                btns += '<a class="btn-detail btn-booking" href="%s" target="_blank" rel="noopener">🎫 預約</a>' % _esc(booking_url)
            parts.append(
                '<div class="detail-card">'
                '<div class="detail-name">📍 %s</div>'
                '%s'
                '<div class="detail-btns">%s</div>'
                '</div>' % (_esc(a["name"]), detail_rows, btns)
            )

    if day_hotels:
        for h in day_hotels:
            url = h.get("url") or ""
            booking_url = h.get("booking_url") or ""
            phone = h.get("phone") or ""
            address = h.get("address") or ""
            detail_rows = ""
            if address:
                detail_rows += '<div class="detail-row"><span class="detail-icon">📍</span><span class="detail-text">%s</span></div>' % _esc(address)
            if phone:
                detail_rows += '<div class="detail-row"><span class="detail-icon">📞</span><span class="detail-text"><a href="tel:%s">%s</a></span></div>' % (_esc(phone), _esc(phone))
            btns = ""
            if url:
                btns += '<a class="btn-detail" href="%s" target="_blank" rel="noopener">🌐 官網</a>' % _esc(url)
            if booking_url:
                btns += '<a class="btn-detail btn-booking" href="%s" target="_blank" rel="noopener">🏨 預訂房</a>' % _esc(booking_url)
            parts.append(
                '<div class="detail-card detail-hotel">'
                '<div class="detail-name">🏨 %s</div>'
                '%s'
                '<div class="detail-btns">%s</div>'
                '</div>' % (_esc(h["name"]), detail_rows, btns)
            )

    return "\n".join(parts) if parts else ""


def _timeline(trip, destination) -> str:
    """Render the vertical day-by-day timeline (Day1..DayN).

    Each day is one timeline item containing 上午交通 / 下午景點 / 晚上酒店
    cards in that default order (no real per-point timing data is available).
    When attractions/hotels have day-specific data, per-point detail cards
    with website/booking/phone info are rendered below.
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

    attractions = getattr(destination, "attractions", None) or []
    hotels = getattr(destination, "hotels", None) or []

    items = []
    for idx, day in enumerate(days, start=1):
        date_line = _esc(_fmt_date(day)) if day is not None else ""
        day_detail = _timeline_day_detail(idx, attractions, hotels)
        items.append(
            '<section class="tl-item">'
            '<span class="tl-dot"></span>'
            '<header class="tl-day"><h2>Day %d</h2><span class="tl-date">%s</span></header>'
            '<div class="tl-body">'
            '<div class="tl-card trans"><h3>上午交通 (Morning Transport)</h3>%s</div>'
            '<div class="tl-card sights"><h3>下午景點 (Afternoon Attractions)</h3>%s</div>'
            '<div class="tl-card hotel"><h3>晚上酒店 (Evening Hotel)</h3>%s</div>'
            '%s'
            "</div></section>"
            % (
                idx,
                date_line,
                _anchor_list(urls["transport"], "交通 (Transport)"),
                _anchor_list(urls["attractions"], "景點 (Attractions)"),
                _anchor_list(urls["hotels"], "住宿 (Hotel)"),
                day_detail,
            )
        )

    return (
        '<section class="card timeline">'
        "<h2>行程時間線 (Itinerary Timeline)</h2>"
        + "".join(items)
        + "</section>"
    )


def _map_section(destination) -> str:
    if destination is None:
        return (
            '<section class="card map"><h2>地圖 (Map)</h2>'
            '<div id="map" class="map-canvas"><p class="map-fallback">'
            "地圖加載中 / Map loading…</p></div></section>"
        )

    attractions = getattr(destination, "attractions", None) or []
    hotels = getattr(destination, "hotels", None) or []
    map_points_attr = getattr(destination, "map_points", None) or []

    all_points = list(map_points_attr)
    if not all_points:
        for a in attractions:
            pt = {
                "name": a["name"], "lat": a["lat"], "lng": a["lng"],
                "type": "attraction", "day": a.get("day"),
                "url": a.get("url"), "phone": a.get("phone"),
                "address": a.get("address"), "booking_url": a.get("booking_url"),
                "station": a.get("station"),
            }
            pt["popupHtml"] = _popup_html(pt)
            all_points.append(pt)
        for h in hotels:
            pt = {
                "name": h["name"], "lat": h["lat"], "lng": h["lng"],
                "type": "hotel", "day": h.get("day"),
                "url": h.get("url"), "phone": h.get("phone"),
                "address": h.get("address"), "booking_url": h.get("booking_url"),
                "station": h.get("station"),
            }
            pt["popupHtml"] = _popup_html(pt)
            all_points.append(pt)
    all_points.sort(key=lambda p: (p.get("day") or 9999))

    if not all_points:
        return (
            '<section class="card map"><h2>地圖 (Map)</h2>'
            '<div id="map" class="map-canvas"><p class="map-fallback">'
            "地圖加載中 / Map loading…</p></div></section>"
        )

    return (
        '<section class="card map"><h2>地圖 (Map)</h2>'
        '<div id="map" class="map-canvas"></div></section>'
    ) + "<script>window.__MAP_POINTS__=" + json.dumps(
        all_points, ensure_ascii=False
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


def _popup_html(p: dict) -> str:
    """Build a Leaflet popup HTML string for one map point."""
    is_hotel = p.get("type") == "hotel"
    icon = "🏨 " if is_hotel else "📍 "
    name = _esc(p.get("name", ""))
    day = p.get("day")
    url = p.get("url") or ""
    phone = p.get("phone") or ""
    parts = ['<div style="min-width:150px">']
    parts.append("<b>" + icon + name + "</b>")
    if day:
        parts.append("<br><span style='color:#6b7280;font-size:.8em'>Day " + _esc(day) + "</span>")
    if url:
        link_label = "官網" if not is_hotel else "住宿官網"
        if is_hotel:
            booking_url = p.get("booking_url") or ""
            parts.append(
                '<br><a href="%s" target="_blank" rel="noopener" '
                'style="display:inline-block;margin-top:6px;padding:4px 10px;'
                'background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;'
                'font-size:.85em">🌐 官網</a>' % _esc(url)
            )
            if booking_url:
                parts.append(
                    ' <a href="%s" target="_blank" rel="noopener" '
                    'style="display:inline-block;margin-top:6px;padding:4px 10px;'
                    'background:#dc2626;color:#fff;border-radius:6px;text-decoration:none;'
                    'font-size:.85em">🏨 預訂房</a>' % _esc(booking_url)
                )
        else:
            booking_url = p.get("booking_url") or ""
            parts.append(
                '<br><a href="%s" target="_blank" rel="noopener" '
                'style="display:inline-block;margin-top:6px;padding:4px 10px;'
                'background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;'
                'font-size:.85em">🌐 官網</a>' % _esc(url)
            )
            if booking_url:
                parts.append(
                    ' <a href="%s" target="_blank" rel="noopener" '
                    'style="display:inline-block;margin-top:6px;padding:4px 10px;'
                    'background:#0891b2;color:#fff;border-radius:6px;text-decoration:none;'
                    'font-size:.85em">🎫 預約</a>' % _esc(booking_url)
                )
    if phone:
        parts.append(
            '<br><span style="color:#374151;font-size:.85em">'
            '📞 <a href="tel:%s" style="color:#2563eb">%s</a></span>'
            % (_esc(phone), _esc(phone))
        )
    if p.get("address"):
        parts.append(
            '<br><span style="color:#6b7280;font-size:.8em">📍 %s</span>'
            % _esc(p.get("address"))
        )
    station = p.get("station") or {}
    if isinstance(station, dict) and station.get("name"):
        parts.append(
            '<br><span style="color:#374151;font-size:.85em">🚇 %s（%s）</span>'
            % (_esc(station.get("name")), _esc(station.get("line")))
        )
    parts.append("</div>")
    return "".join(parts)


def _init_map_script() -> str:
    return (
        "<script>\n"
        "window.addEventListener('DOMContentLoaded', function () {\n"
        "  var points = window.__MAP_POINTS__;\n"
        "  var el = document.getElementById('map');\n"
        "  if (!el || !points || !points.length) return;\n"
        "  if (typeof L === 'undefined') {\n"
        "    var rows = '';\n"
        "    points.forEach(function (p) {\n"
        "      var d = p.day ? 'Day ' + p.day + ' \\u2014 ' : '';\n"
        "      var icon = p.type === 'hotel' ? '\\uD83C\\uDFE8 ' : '\\uDCCD';\n"
        "      var lnk = p.url ? ' <a href=\"' + p.url + '\" target=\"_blank\" rel=\"noopener\" style=\"color:#2563eb;font-size:.85em\">\\uD83C\\uDF10</a>' : '';\n"
        "      var ph = p.phone ? ' \\uD83D\\uDCD1 ' + p.phone : '';\n"
        "      rows += '<div class=\"map-list-item\">' + d + icon + p.name + lnk + ph + '</div>';\n"
        "    });\n"
        "    el.innerHTML = '<div class=\"map-fallback\" style=\"padding:16px;text-align:left\"><p style=\"margin:0 0 8px;color:#6b7280\">地圖無法載入（離線）。行程點：</p>' + rows + '</div>';\n"
        "    return;\n"
        "  }\n"
        "  var map = L.map(el);\n"
        "  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {\n"
        "    maxZoom: 19,\n"
        "    attribution: '&copy; OpenStreetMap contributors'\n"
        "  }).addTo(map);\n"
        "  var routeCoords = [];\n"
        "  points.forEach(function (p) {\n"
        "    var isHotel = p.type === 'hotel';\n"
        "    var color = isHotel ? '#dc2626' : '#2563eb';\n"
        "    var icon = L.divIcon({\n"
        "      className: '',\n"
        "      html: '<div style=\"background:' + color + ';width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4);\"></div>',\n"
        "      iconSize: [14, 14],\n"
        "      iconAnchor: [7, 7]\n"
        "    });\n"
        "    L.marker([p.lat, p.lng], {icon: icon}).addTo(map)\n"
        "      .bindPopup(p.popupHtml || '<b>' + (isHotel ? '\\uD83C\\uDFE8 ' : '\\uDCCD') + p.name + '</b>' + (p.day ? '<br>Day ' + p.day : ''));\n"
        "    routeCoords.push([p.lat, p.lng]);\n"
        "  });\n"
        "  if (routeCoords.length > 1) {\n"
        "    L.polyline(routeCoords, {color: '#2563eb', weight: 3, dashArray: '8,6'}).addTo(map);\n"
        "  }\n"
        "  map.fitBounds(routeCoords, {padding: [30, 30]});\n"
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

    attractions = getattr(destination, "attractions", None) or []
    hotels = getattr(destination, "hotels", None) or []
    map_points_attr = getattr(destination, "map_points", None) or []

    all_points = list(map_points_attr)
    if not all_points:
        for a in attractions:
            pt = {
                "name": a["name"], "lat": a["lat"], "lng": a["lng"],
                "type": "attraction", "day": a.get("day"),
                "url": a.get("url"), "phone": a.get("phone"),
                "address": a.get("address"), "booking_url": a.get("booking_url"),
                "station": a.get("station"),
            }
            pt["popupHtml"] = _popup_html(pt)
            all_points.append(pt)
        for h in hotels:
            pt = {
                "name": h["name"], "lat": h["lat"], "lng": h["lng"],
                "type": "hotel", "day": h.get("day"),
                "url": h.get("url"), "phone": h.get("phone"),
                "address": h.get("address"), "booking_url": h.get("booking_url"),
                "station": h.get("station"),
            }
            pt["popupHtml"] = _popup_html(pt)
            all_points.append(pt)
    all_points.sort(key=lambda p: (p.get("day") or 9999))

    if not all_points and point_lat is not None and point_lng is not None:
        fallback = {"name": dest_name, "lat": point_lat, "lng": point_lng,
                     "type": "attraction", "day": None}
        fallback["popupHtml"] = _popup_html(fallback)
        all_points = [fallback]

    map_init_script = _init_map_script() if all_points else ""

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
<script src="{LEAFLET_JS}"></script>
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
  .detail-card {{
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 10px 12px;
  }}
  .detail-card.detail-hotel {{ border-left: 3px solid #dc2626; }}
  .detail-name {{ font-weight: 700; color: #111827; margin-bottom: 4px; }}
  .detail-row {{ display: flex; gap: 6px; align-items: flex-start; font-size: .85rem; color: #374151; margin-bottom: 2px; }}
  .detail-icon {{ flex: none; }}
  .detail-text a {{ color: #2563eb; text-decoration: none; }}
  .detail-btns {{ display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }}
  .btn-detail {{
    display: inline-block; padding: 6px 12px; border-radius: 8px;
    background: #eef2ff; color: #2563eb; font-weight: 600;
    text-decoration: none; border: 1px solid #c7d2fe; font-size: .85rem;
  }}
  .btn-detail:hover {{ background: #e0e7ff; }}
  .btn-detail.btn-booking {{ background: #fee2e2; color: #dc2626; border-color: #fecaca; }}
  .btn-detail.btn-booking:hover {{ background: #fecaca; }}
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
