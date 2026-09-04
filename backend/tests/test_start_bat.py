"""Tests for start.bat – assert the script contains required robustness patterns."""

from pathlib import Path

START_BAT = Path(__file__).resolve().parent.parent.parent / "start.bat"
assert START_BAT.exists(), f"start.bat not found at {START_BAT}"
START_TEXT = START_BAT.read_text(encoding="utf-8")


def test_health_poll_loop_exists() -> None:
    """start.bat must poll /health with curl in a loop."""
    assert "curl.exe" in START_TEXT, "curl.exe not found in start.bat"
    assert "localhost:8000/health" in START_TEXT, "health URL not found"
    assert ":wait_loop" in START_TEXT, "wait_loop label not found"
    assert ":wait_done" in START_TEXT, "wait_done label not found"


def test_thirty_second_timeout() -> None:
    """Health-poll loop must cap at 30 seconds."""
    assert "geq 30" in START_TEXT, "30-second cap not found"


def test_reuse_existing_backend() -> None:
    """If port 8000 already responds 200 on /health, skip launching uvicorn."""
    assert ":start_frontend" in START_TEXT, "start_frontend label not found"
    assert "不再重复启动" in START_TEXT, "reuse hint text missing"


def test_seed_failure_stops() -> None:
    """Seed failure must abort with an error message."""
    assert "数据库初始化失败" in START_TEXT, "seed failure message missing"
    assert "exit /b 1" in START_TEXT, "exit /b 1 missing"


def test_backend_failure_stops() -> None:
    """If health check fails after 30 s, script must stop and guide the user."""
    assert "后端 30 秒内未就绪" in START_TEXT, "backend timeout message missing"
    assert "查看" in START_TEXT and "后端" in START_TEXT, "window hint missing"


def test_chcp_and_pause_preserved() -> None:
    """Script must keep UTF-8 code page and interactive pause."""
    assert "chcp 65001" in START_TEXT, "chcp 65001 missing"
    assert "pause" in START_TEXT, "pause missing"


def test_window_titles() -> None:
    """Both backend and frontend windows must have identifiable titles."""
    assert "Travel Companion 后端" in START_TEXT, "backend window title missing"
    assert "Travel Companion 前端" in START_TEXT, "frontend window title missing"


def test_crlf_line_endings() -> None:
    """start.bat must use CRLF line endings — cmd.exe misparses LF-only batch files."""
    raw = START_BAT.read_bytes()
    total_lf = raw.count(b"\n")
    crlf = raw.count(b"\r\n")
    assert total_lf > 0, "start.bat has no lines"
    assert crlf == total_lf, f"start.bat must be pure CRLF (crlf={crlf}, lf={total_lf})"
