"""Tests for optional same-origin SPA hosting (Vite build output)."""

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import _mount_frontend, _resolve_frontend_file, create_app


def _make_dist(root) -> None:
    root.mkdir(parents=True, exist_ok=True)
    (root / "index.html").write_text("<html><body>spa-shell</body></html>", encoding="utf-8")
    assets = root / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "app.js").write_text("console.log('app')", encoding="utf-8")


def test_resolve_frontend_file_serves_exact_files_only(tmp_path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>shell</html>", encoding="utf-8")
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("x", encoding="utf-8")

    assert _resolve_frontend_file(dist, "") is not None
    assert _resolve_frontend_file(dist, "/").name == "index.html"
    assert _resolve_frontend_file(dist, "assets/app.js").name == "app.js"
    # Directories fall through to the SPA shell (handled by caller).
    assert _resolve_frontend_file(dist, "assets") is None
    # Missing build or missing file resolves to None, never outside root.
    assert _resolve_frontend_file(tmp_path / "nope", "assets/app.js") is None
    assert _resolve_frontend_file(dist, "../outside.txt") is None
    assert _resolve_frontend_file(dist, "missing.png") is None


def test_spa_shell_and_assets_with_reserved_api_404(tmp_path, monkeypatch) -> None:
    dist = tmp_path / "dist"
    _make_dist(dist)
    monkeypatch.setattr(main_module, "FRONTEND_DIST", dist)

    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)
    try:
        root = client.get("/")
        assert root.status_code == 200
        assert "spa-shell" in root.text

        deep_link = client.get("/plan")
        assert deep_link.status_code == 200
        assert "spa-shell" in deep_link.text

        asset = client.get("/assets/app.js")
        assert asset.status_code == 200
        assert "console.log" in asset.text

        missing_api = client.get("/api/no-such-route")
        assert missing_api.status_code == 404
        assert "spa-shell" not in missing_api.text
    finally:
        client.close()


def test_no_frontend_build_serves_api_only(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main_module, "FRONTEND_DIST", tmp_path / "empty-dist")
    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)
    try:
        assert client.get("/no-such-page").status_code == 404
        assert client.get("/health").status_code == 200
    finally:
        client.close()
