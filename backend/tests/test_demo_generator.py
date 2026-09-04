"""Tests for the static demo.html generator (scripts/generate_demo.py).

The demo generator reuses the same pure-function HTML renderer that powers the
real export route; these tests verify the demo-specific wiring (trip /
destination / next-trip data and where the file lands).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT = ROOT / "scripts" / "generate_demo.py"
OUT = ROOT / "demo.html"


def _run_generator() -> str:
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return result.stdout


def test_generator_runs_and_reports_output_path():
    out = _run_generator()
    assert "Written to" in out
    assert str(OUT).replace("\\", "/") in out.replace("\\", "/")


def test_generated_demo_is_static_html_with_expected_meta():
    _run_generator()
    assert OUT.exists(), "demo.html should be written to the project root"
    html = OUT.read_text(encoding="utf-8")
    assert html.startswith("<!DOCTYPE html>")
    assert "<html" in html and "</html>" in html
    assert "京都大阪紅葉之旅" in html
    assert "property=\"og:title\"" in html
    assert "property=\"og:description\"" in html


def test_generated_demo_has_countdown_links_and_map_placeholder():
    _run_generator()
    html = OUT.read_text(encoding="utf-8")
    assert 'id="countdown"' in html
    assert "setInterval" in html
    assert "booking.com" in html
    assert "jalan.net" in html
    assert "/maps/dir" in html
    assert "leaflet" in html
    assert "__MAP_POINT__" in html


def test_generated_demo_includes_next_trip_teaser():
    _run_generator()
    html = OUT.read_text(encoding="utf-8")
    assert "下次旅程" in html
    assert "東京初春賞樱" in html
