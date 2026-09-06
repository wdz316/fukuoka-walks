"""Contract roundtrip tests for the REST API (docs/openapi.yaml)."""

from fastapi.testclient import TestClient


def test_recommend_returns_sorted_scores(client: TestClient) -> None:
    body = {
        "start_date": "2026-03-20",
        "end_date": "2026-03-22",
        "interests": ["food", "city"],
        "budget": 500000,
    }
    resp = client.post("/api/recommend", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    scores = [item["score"] for item in data]
    assert scores == sorted(scores, reverse=True)
    for item in data:
        assert "destination" in item
        assert "score" in item
        assert "reason" in item


def test_recommend_with_holiday_type_weekend(client: TestClient) -> None:
    body = {"start_date": "2026-03-20", "holiday_type": "weekend"}
    resp = client.post("/api/recommend", json=body)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_and_list_and_delete_trip(client: TestClient) -> None:
    create = client.post(
        "/api/trips",
        json={
            "title": "Golden Week Tokyo",
            "start_date": "2026-04-29",
            "end_date": "2026-05-05",
            "notes": "Cherry blossoms",
        },
        headers={"X-Device-Id": "device-abc"},
    )
    assert create.status_code == 201
    trip = create.json()
    assert trip["id"] > 0
    assert trip["title"] == "Golden Week Tokyo"

    listing = client.get("/api/trips", headers={"X-Device-Id": "device-abc"})
    assert listing.status_code == 200
    assert any(t["id"] == trip["id"] for t in listing.json())

    # different device scope should not see the trip
    other = client.get("/api/trips", headers={"X-Device-Id": "other-device"})
    assert all(t["id"] != trip["id"] for t in other.json())

    delete_resp = client.delete(f"/api/trips/{trip['id']}")
    assert delete_resp.status_code == 204

    deleted_list = client.get("/api/trips", headers={"X-Device-Id": "device-abc"})
    assert all(t["id"] != trip["id"] for t in deleted_list.json())


def test_delete_trip_not_found(client: TestClient) -> None:
    resp = client.delete("/api/trips/999999")
    assert resp.status_code == 404


def test_export_returns_html_itinerary(client: TestClient) -> None:
    create = client.post(
        "/api/trips",
        json={
            "title": "Golden Week Tokyo",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "notes": "Cherry blossoms",
        },
    )
    trip_id = create.json()["id"]
    resp = client.get(f"/api/trips/{trip_id}/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    body = resp.text
    assert body.startswith("<!DOCTYPE html>")
    assert "Golden Week Tokyo" in body
    # Open Graph meta tags + live countdown present in the exported HTML
    assert 'property="og:title"' in body
    assert 'property="og:description"' in body
    assert 'id="countdown"' in body
    assert "setInterval" in body

    missing = client.get("/api/trips/999999/export")
    assert missing.status_code == 404


def test_export_renders_destination_attractions_hotels_from_db(client: TestClient) -> None:
    """Export must render attractions/hotels stored as JSON strings in the DB."""
    create = client.post(
        "/api/trips",
        json={
            "title": "Kyoto Temples",
            "start_date": "2026-05-01",
            "end_date": "2026-05-04",
            "destination_id": 2,  # Kyoto in the seeded catalogue
            "notes": "Temple walk",
        },
    )
    assert create.status_code == 201
    trip_id = create.json()["id"]
    resp = client.get(f"/api/trips/{trip_id}/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    body = resp.text
    # DB-stored attraction/hotel names rendered in the map points
    assert "伏見稲荷大社" in body
    assert "清水寺" in body
    assert "祇園旅館" in body
    assert 'id="countdown"' in body
    assert "setInterval" in body


def test_destinations_list(client: TestClient) -> None:
    resp = client.get("/api/destinations")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 50

    filtered = client.get("/api/destinations?region=Europe&season=summer")
    assert filtered.status_code == 200
    for dest in filtered.json():
        assert dest["region"] == "Europe"
        assert dest["best_season"] == "summer"


def test_preferences_roundtrip(client: TestClient) -> None:
    empty = client.get("/api/preferences", headers={"X-Device-Id": "pref-dev"})
    assert empty.status_code == 200
    assert empty.json() == {"origin": None, "interests": [], "budget": None, "ai_provider": None}

    payload = {
        "origin": "Tokyo",
        "interests": ["food", "nature"],
        "budget": 200000,
        "ai_provider": "rule",
    }
    put = client.put("/api/preferences", json=payload, headers={"X-Device-Id": "pref-dev"})
    assert put.status_code == 200
    saved = put.json()
    assert saved["origin"] == "Tokyo"
    assert set(saved["interests"]) == {"food", "nature"}
    assert saved["budget"] == 200000
    assert saved["ai_provider"] == "rule"

    got = client.get("/api/preferences", headers={"X-Device-Id": "pref-dev"})
    assert got.json() == saved


def test_destinations_carry_places_and_cost_levels(client: TestClient) -> None:
    resp = client.get("/api/destinations")
    assert resp.status_code == 200
    data = resp.json()
    kyoto = next(d for d in data if d["name"] == "Kyoto")
    assert isinstance(kyoto["attractions"], list) and len(kyoto["attractions"]) >= 1
    assert kyoto["attractions"][0]["name"]
    assert isinstance(kyoto["cost_level_1"], int)


def test_recommend_carries_places_cost_and_japanese_reasons(
    client: TestClient,
) -> None:
    body = {
        "start_date": "2026-09-05",
        "end_date": "2026-09-06",
        "origin": "福冈",
    }
    resp = client.post("/api/recommend", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert data[0]["destination"]["name"] == "Fukuoka"
    assert isinstance(data[0]["destination"]["attractions"], list)
    assert any("予算" in (r or "") or "同都市" in (r or "") or "短期" in (r or "")
               for item in data for r in [item["reason"]])
    for item in data:
        assert "Good fit" not in (item["reason"] or "")
        assert "Novel" not in (item["reason"] or "")
