import json
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import Engine, create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import Destination, Preference, Trip, Visit
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


def test_seed_backfills_attractions_on_existing_rows() -> None:
    db = _session()
    try:
        seed_destinations(db)
        fukuoka = db.scalar(select(Destination).where(Destination.name == "Fukuoka"))
        assert fukuoka is not None
        # Simulate an old row seeded before attractions existed.
        fukuoka.attractions = None
        fukuoka.hotels = None
        db.commit()
        backfilled = seed_destinations(db)
        db.refresh(fukuoka)
        assert backfilled >= 1
        names = [a["name"] for a in json.loads(fukuoka.attractions)]
        assert "櫛田神社" in names
        assert json.loads(fukuoka.hotels)
    finally:
        db.close()


def test_fukuoka_seed_has_attractions_with_coords_and_links() -> None:
    with (TEST_DATA_DIR / "destinations.json").open(encoding="utf-8") as f:
        destinations = json.load(f)
    fukuoka = next(d for d in destinations if d["name"] == "Fukuoka")
    assert len(fukuoka["attractions"]) >= 3
    for a in fukuoka["attractions"]:
        assert isinstance(a["lat"], float) and isinstance(a["lng"], float)
        assert a["url"].startswith("https://")
    assert len(fukuoka["hotels"]) >= 1


def test_seed_refreshes_station_info_on_existing_rows() -> None:
    db = _session()
    try:
        seed_destinations(db)
        fukuoka = db.scalar(select(Destination).where(Destination.name == "Fukuoka"))
        assert fukuoka is not None
        # Simulate an old row seeded before station info existed.
        spots = json.loads(fukuoka.attractions)
        for s in spots:
            s.pop("station", None)
        fukuoka.attractions = json.dumps(spots, ensure_ascii=False)
        db.commit()
        refreshed = seed_destinations(db)
        db.refresh(fukuoka)
        assert refreshed >= 1
        assert all("station" in a for a in json.loads(fukuoka.attractions))
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


def test_trip_defaults_to_planned_status() -> None:
    db = _session()
    try:
        trip = Trip(
            title="福冈一日游",
            start_date=date(2026, 9, 10),
            end_date=date(2026, 9, 10),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        assert trip.status == "planned"
    finally:
        db.close()


def test_visit_roundtrip() -> None:
    db = _session()
    try:
        trip = Trip(
            title="福冈巡礼",
            start_date=date(2026, 9, 10),
            end_date=date(2026, 9, 10),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        visit = Visit(
            device_id="fp-dev",
            destination_id=trip.destination_id,
            attraction_name="大濠公園",
            visited_at=datetime.now(),
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)
        loaded = db.scalar(select(Visit).where(Visit.id == visit.id))
        assert loaded is not None
        assert loaded.device_id == "fp-dev"
        assert loaded.attraction_name == "大濠公園"
    finally:
        db.close()


def _old_schema_engine(tmp_path: Path) -> Engine:
    from sqlalchemy import text

    engine = create_engine(
        f"sqlite:///{tmp_path}/old.db", connect_args={"check_same_thread": False}
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE trips ("
                "id INTEGER PRIMARY KEY, title VARCHAR(255) NOT NULL, "
                "destination_id INTEGER, start_date DATE NOT NULL, end_date DATE NOT NULL, "
                "budget FLOAT, comment TEXT, notes TEXT, device_id VARCHAR(128), "
                "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO trips (title, start_date, end_date, created_at, updated_at) "
                "VALUES ('旧行程', '2026-01-01', '2026-01-02', "
                "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            )
        )
    return engine


def test_run_migrations_adds_status_column_to_old_trips_table(tmp_path: Path) -> None:
    from sqlalchemy import text

    from app.db import run_migrations

    engine = _old_schema_engine(tmp_path)
    run_migrations(engine)
    # idempotent — running again must not blow up
    run_migrations(engine)

    with engine.begin() as conn:
        existing = conn.execute(text("SELECT status FROM trips WHERE title = '旧行程'")).fetchone()
        assert existing[0] == "planned"
        conn.execute(
            text(
                "INSERT INTO trips (title, start_date, end_date, created_at, updated_at) "
                "VALUES ('新行程', '2026-02-01', '2026-02-02', "
                "'2026-02-01 00:00:00', '2026-02-01 00:00:00')"
            )
        )
        new_row = conn.execute(text("SELECT status FROM trips WHERE title = '新行程'")).fetchone()
    assert new_row[0] == "planned"


def test_run_migrations_creates_visits_table_on_fresh_db(tmp_path: Path) -> None:
    from sqlalchemy import text

    from app.db import run_migrations

    engine = create_engine(
        f"sqlite:///{tmp_path}/new.db", connect_args={"check_same_thread": False}
    )
    run_migrations(engine)
    with engine.connect() as conn:
        trips_cols = {r[1] for r in conn.execute(text("PRAGMA table_info(trips)"))}
        visits_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='visits'")
        ).fetchone()
    assert "status" in trips_cols
    assert visits_exists is not None