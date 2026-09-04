import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine
from app.models import Destination

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(filename: str) -> list[dict]:
    with (DATA_DIR / filename).open(encoding="utf-8") as f:
        return json.load(f)


def _serialize_attractions_hotels(row: dict) -> tuple[str | None, str | None]:
    """Serialize attractions and hotels lists to JSON strings for the DB."""
    attractions_raw = row.get("attractions") or []
    hotels_raw = row.get("hotels") or []
    attractions = (
        json.dumps(attractions_raw, ensure_ascii=False)
        if attractions_raw
        else None
    )
    hotels = (
        json.dumps(hotels_raw, ensure_ascii=False) if hotels_raw else None
    )
    return attractions, hotels


def seed_destinations(db: Session) -> int:
    rows = _load_json("destinations.json")
    created = 0
    for row in rows:
        exists = db.scalar(
            select(Destination).where(Destination.name == row["name"])
        )
        if exists is not None:
            continue
        attractions_json, hotels_json = _serialize_attractions_hotels(row)
        db.add(
            Destination(
                name=row["name"],
                country=row["country"],
                region=row["region"],
                description=row.get("description"),
                best_season=row.get("best_season"),
                lat=row.get("lat"),
                lng=row.get("lng"),
                attractions=attractions_json,
                hotels=hotels_json,
                cost_level_1=row.get("cost_level_1"),
                cost_level_2=row.get("cost_level_2"),
                cost_level_3=row.get("cost_level_3"),
                cost_level_4=row.get("cost_level_4"),
                tags=json.dumps(row.get("tags", []), ensure_ascii=False),
                image_url=row.get("image_url"),
            )
        )
        created += 1
    db.commit()
    return created


def run() -> int:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        return seed_destinations(db)


if __name__ == "__main__":
    n = run()
    print(f"Seeded {n} destination(s) (idempotent).")