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


def test_create_and_list_and_delete_visit(client: TestClient) -> None:
    device = "footprint-dev"
    headers = {"X-Device-Id": device}
    created = client.post(
        "/api/visits",
        json={"destination_id": 5, "attraction_name": "大濠公園"},
        headers=headers,
    )
    assert created.status_code == 201
    visit = created.json()
    assert visit["id"] > 0
    assert visit["device_id"] == device
    assert visit["destination_id"] == 5
    assert visit["attraction_name"] == "大濠公園"
    assert visit["visited_at"]

    listing = client.get("/api/visits", headers=headers)
    assert listing.status_code == 200
    assert any(v["id"] == visit["id"] for v in listing.json())

    # different device scope should not see the visit
    other = client.get("/api/visits", headers={"X-Device-Id": "other-fp"})
    assert all(v["id"] != visit["id"] for v in other.json())

    deleted = client.delete(f"/api/visits/{visit['id']}", headers=headers)
    assert deleted.status_code == 204

    after = client.get("/api/visits", headers=headers)
    assert all(v["id"] != visit["id"] for v in after.json())


def test_visits_scope_via_query_device_id(client: TestClient) -> None:
    created = client.post(
        "/api/visits?device_id=q-dev", json={"attraction_name": "福岡タワー"}
    )
    assert created.status_code == 201
    assert created.json()["device_id"] == "q-dev"

    owned = client.get("/api/visits?device_id=q-dev")
    assert any(v["attraction_name"] == "福岡タワー" for v in owned.json())

    scoped_away = client.get("/api/visits?device_id=other-q")
    assert all(v["attraction_name"] != "福岡タワー" for v in scoped_away.json())


def test_delete_visit_not_found_or_not_owned(client: TestClient) -> None:
    device = "fp-owner"
    headers = {"X-Device-Id": device}
    created = client.post("/api/visits", json={"attraction_name": "太宰府天満宮"}, headers=headers)
    assert created.status_code == 201
    visit_id = created.json()["id"]

    not_owned = client.delete(f"/api/visits/{visit_id}", headers={"X-Device-Id": "someone-else"})
    assert not_owned.status_code == 404
    assert client.delete("/api/visits/999999", headers=headers).status_code == 404

    # the owner can still delete it
    assert client.delete(f"/api/visits/{visit_id}", headers=headers).status_code == 204


def test_complete_trip_marks_done_and_creates_visits_idempotently(client: TestClient) -> None:
    device = "trip-dev"
    headers = {"X-Device-Id": device}
    created = client.post(
        "/api/trips",
        json={
            "title": "福冈市内一日游",
            "start_date": "2026-09-10",
            "end_date": "2026-09-10",
            "destination_id": 3,
        },
        headers=headers,
    )
    assert created.status_code == 201
    trip = created.json()
    assert trip["status"] == "planned"

    stops = ["大濠公園", "櫛田神社", "太宰府天満宮"]
    done = client.post(f"/api/trips/{trip['id']}/complete", json={"stops": stops}, headers=headers)
    assert done.status_code == 200
    assert done.json()["status"] == "done"

    visits = client.get("/api/visits", headers=headers).json()
    names = {v["attraction_name"] for v in visits}
    assert set(stops) <= names
    assert all(v["destination_id"] == trip["destination_id"] for v in visits)

    # re-completing with the same stops is idempotent: no duplicate visits
    again = client.post(f"/api/trips/{trip['id']}/complete", json={"stops": stops}, headers=headers)
    assert again.status_code == 200
    assert again.json()["status"] == "done"
    after = client.get("/api/visits", headers=headers).json()
    assert len(after) == len(visits)
    for name in stops:
        assert sum(1 for v in after if v["attraction_name"] == name) == 1


def test_complete_trip_device_scoped_and_missing_trip(client: TestClient) -> None:
    trip = client.post(
        "/api/trips",
        json={"title": "秘密行程", "start_date": "2026-09-10", "end_date": "2026-09-10"},
    ).json()
    other_device = client.post(
        f"/api/trips/{trip['id']}/complete",
        json={"stops": ["A"]},
        headers={"X-Device-Id": "whoami"},
    )
    assert other_device.status_code == 404
    assert client.post("/api/trips/999999/complete", json={"stops": ["A"]}).status_code == 404


def test_list_trips_returns_status(client: TestClient) -> None:
    device = "status-dev"
    headers = {"X-Device-Id": device}
    created = client.post(
        "/api/trips",
        json={"title": "天神散策", "start_date": "2026-09-12", "end_date": "2026-09-13"},
        headers=headers,
    ).json()
    assert created["status"] == "planned"

    listing = client.get("/api/trips", headers=headers)
    assert listing.status_code == 200
    listed = next(t for t in listing.json() if t["id"] == created["id"])
    assert listed["status"] == "planned"
