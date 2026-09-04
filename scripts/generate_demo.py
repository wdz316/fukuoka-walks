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
        {"name": "伏見稲荷大社", "lat": 34.9671, "lng": 135.7727, "day": 1},
        {"name": "清水寺", "lat": 34.9949, "lng": 135.7850, "day": 1},
        {"name": "二条城", "lat": 35.0142, "lng": 135.7483, "day": 2},
        {"name": "金閣寺", "lat": 35.0394, "lng": 135.7292, "day": 2},
        {"name": "嵐山竹林", "lat": 35.0170, "lng": 135.6713, "day": 3},
        {"name": "道頓堀", "lat": 34.6687, "lng": 135.5013, "day": 4},
        {"name": "大阪城", "lat": 34.6873, "lng": 135.5259, "day": 5},
    ]
    hotels = [
        {"name": "祇園旅館 (Gion Hotel)", "lat": 35.0036, "lng": 135.7753, "day": 1},
        {"name": "難波ホテル (Namba Hotel)", "lat": 34.6658, "lng": 135.5010, "day": 3},
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
