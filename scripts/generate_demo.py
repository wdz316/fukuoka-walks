"""Generate demo.html using the export generator.

Usage:
    backend\\.venv\\Scripts\\python.exe scripts\\generate_demo.py

Writes demo.html to the project root.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.export.generator import render_trip_html  # noqa: E402


class _Trip:
    title = "京都大阪紅葉之旅"
    start_date = date(2026, 11, 15)
    end_date = date(2026, 11, 22)
    budget = 180_000
    notes = "清水寺・伏見稻荷・道頓堀・黑門市場"
    comment = "枫叶季的关西精华游"


class _Dest:
    name = "京都"
    lat = 35.0116
    lng = 135.7681
    attractions = [
        {"name": "伏見稲荷大社", "lat": 34.9671, "lng": 135.7727, "day": 1,
         "url": "https://inari.jp/", "booking_url": "https://inari.jp/",
         "phone": "075-641-7331", "address": "京都市伏見区深草薮之内町68"},
        {"name": "清水寺", "lat": 34.9949, "lng": 135.7850, "day": 1,
         "url": "https://www.kiyomizudera.or.jp/", "booking_url": "https://www.kiyomizudera.or.jp/",
         "phone": "075-551-1234", "address": "京都市東山区清水1丁目294"},
        {"name": "二条城", "lat": 35.0142, "lng": 135.7483, "day": 2,
         "url": "https://nijo-jokamachi.jp/", "booking_url": "https://nijo-jokamachi.jp/",
         "phone": "075-841-0096", "address": "京都市中京区二条通堀川西入内之中之丸町"},
        {"name": "金閣寺", "lat": 35.0394, "lng": 135.7292, "day": 2,
         "url": "https://www.shokoku-ji.jp/kinkaku/", "booking_url": "https://www.shokoku-ji.jp/kinkaku/",
         "phone": "075-461-5226", "address": "京都市北区金閣寺町1"},
        {"name": "嵐山竹林", "lat": 35.0170, "lng": 135.6713, "day": 3,
         "url": "https://www.kyoto-info.guide/", "booking_url": "https://www.booking.com/searchresults.html?ss=%E5%B5%90%E5%B1%B1",
         "phone": "", "address": "京都市右京区嵯峨天龍寺芒ノ馬場町"},
        {"name": "道頓堀", "lat": 34.6687, "lng": 135.5013, "day": 4,
         "url": "https://www.google.com/search?q=%E9%81%93%E9%A0%93%E5%A0%80", "booking_url": "https://www.google.com/search?q=%E9%81%93%E9%A0%93%E5%A0%80+%E3%83%9A%E3%83%BC%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%88",
         "phone": "", "address": "大阪市中央区道頓堀"},
        {"name": "大阪城", "lat": 34.6873, "lng": 135.5259, "day": 5,
         "url": "https://www.osakajo.or.jp/", "booking_url": "https://www.osakajo.or.jp/",
         "phone": "06-6941-3044", "address": "大阪市中央区大手前丁目1-1"},
    ]
    hotels = [
        {"name": "祇園旅館 (Gion Hotel)", "lat": 35.0036, "lng": 135.7753, "day": 1,
         "url": "https://www.booking.com/searchresults.html?ss=%E7%A5%90%E5%9C%92+%E4%BA%AC%E9%83%BD",
         "booking_url": "https://www.booking.com/searchresults.html?ss=%E7%A5%90%E5%9C%92+%E4%BA%AC%E9%83%BD",
         "phone": "+81-75-XXX-XXXX", "address": "京都市東山区祇園町"},
        {"name": "難波ホテル (Namba Hotel)", "lat": 34.6658, "lng": 135.5010, "day": 3,
         "url": "https://www.booking.com/searchresults.html?ss=%E9%9B%A3%E6%B3%A2+%E5%A4%A7%E9%98%AA",
         "booking_url": "https://www.booking.com/searchresults.html?ss=%E9%9B%A3%E6%B3%A2+%E5%A4%A7%E9%98%AA",
         "phone": "+81-6-XXX-XXXX", "address": "大阪市中央区難波"},
    ]


class _Next:
    title = "東京初春賞樱"
    start_date = date(2027, 3, 25)


def main() -> None:
    html = render_trip_html(_Trip(), _Dest(), next_trip=_Next())
    out = ROOT / "demo.html"
    out.write_text(html, encoding="utf-8")
    print(f"Written to {out}")


if __name__ == "__main__":
    main()
