from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_version_returns_short_sha(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("RENDER_GIT_COMMIT", "0123456789abcdef")
    # Re-read env at request time: delete cached settings is unnecessary since
    # the endpoint reads os.environ per request.
    response = client.get("/api/version")
    assert response.status_code == 200
    assert response.json() == {"sha": "0123456789ab"}


def test_version_defaults_to_dev(client: TestClient, monkeypatch) -> None:
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    monkeypatch.delenv("GIT_SHA", raising=False)
    response = client.get("/api/version")
    assert response.status_code == 200
    assert response.json() == {"sha": "dev"}
