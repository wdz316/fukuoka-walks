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
