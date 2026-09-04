import json
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Destination, Preference, Trip
from app.seed import seed_destinations

TEST_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEST_DATABASE_URL = "sqlite://"


def _session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_destinations_json_has_at_least_50() -> None:
    with (TEST_DATA_DIR / "destinations.json").open(encoding="utf-8") as f:
        destinations = json.load(f)
    assert len(destinations) >= 50


def test_destinations_json_has_all_required_fields() -> None:
    with (TEST_DATA_DIR / "destinations.json").open(encoding="utf-8") as f:
        destinations = json.load(f)
    required = {
        "name",
        "country",
        "region",
        "description",
        "best_season",
        "lat",
        "lng",
        "cost_level_1",
        "cost_level_2",
        "cost_level_3",
        "cost_level_4",
        "tags",
        "image_url",
    }
    for dest in destinations:
        assert required.issubset(dest.keys()), f"missing fields in {dest['name']}"
        for level in ("cost_level_1", "cost_level_2", "cost_level_3", "cost_level_4"):
            assert 1 <= dest[level] <= 10


def test_seed_destinations_idempotent_and_count() -> None:
    db = _session()
    try:
        first = seed_destinations(db)
        second = seed_destinations(db)
        count = db.scalar(select(func.count()).select_from(Destination))
        assert first >= 50
        assert second == 0
        assert count >= 50
    finally:
        db.close()


def test_trip_roundtrip_with_destination() -> None:
    db = _session()
    try:
        seed_destinations(db)
        tokyo = db.scalar(select(Destination).where(Destination.name == "Tokyo"))
        assert tokyo is not None
        assert tokyo.lat == 35.6762
        assert json.loads(tokyo.tags)[:1] == ["city"]

        trip = Trip(
            title="Tokyo Spring Trip",
            destination_id=tokyo.id,
            start_date=date(2026, 3, 20),
            end_date=date(2026, 3, 27),
            budget=200000.0,
            comment="Golden Week run-up",
            notes="Booked hotel",
            device_id="test-device-1",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        assert trip.id is not None
        loaded = db.scalar(select(Trip).where(Trip.id == trip.id))
        assert loaded is not None
        assert loaded.title == "Tokyo Spring Trip"
        assert loaded.start_date == date(2026, 3, 20)
        assert loaded.end_date == date(2026, 3, 27)
        assert loaded.budget == 200000.0
        assert loaded.destination.name == "Tokyo"
    finally:
        db.close()


def test_preference_roundtrip() -> None:
    db = _session()
    try:
        pref = Preference(category="interest", value="food", weight=0.8)
        db.add(pref)
        db.commit()
        db.refresh(pref)
        assert pref.id is not None

        loaded = db.scalar(select(Preference).where(Preference.id == pref.id))
        assert loaded is not None
        assert loaded.category == "interest"
        assert loaded.value == "food"
        assert loaded.weight == 0.8
    finally:
        db.close()


def test_preference_roundtrip_null_weight_default() -> None:
    db = _session()
    try:
        pref = Preference(category="region", value="Europe")
        db.add(pref)
        db.commit()
        db.refresh(pref)
        loaded = db.scalar(select(Preference).where(Preference.id == pref.id))
        assert loaded is not None
        assert loaded.weight is None
    finally:
        db.close()