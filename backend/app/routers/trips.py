"""POST /api/trips, GET /api/trips, DELETE /api/trips/{id},
GET /api/trips/{id}/export  (single-file HTML itinerary export).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.export.generator import render_trip_html
from app.models import Destination, Trip
from app.schemas import Trip as TripSchema, TripIn

router = APIRouter(prefix="/api/trips", tags=["Trips"])


def _as_list(raw) -> list:
    """Deserialize a JSON-string column (attractions/hotels) into a list."""
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []


def _place_list(raw) -> list[dict]:
    """Deserialize a JSON-string column into a list of named place dicts."""
    items = _as_list(raw)
    return [i for i in items if isinstance(i, dict) and i.get("name")]


_SEED_PLACES: dict[str, dict] | None = None


def _seed_places() -> dict[str, dict]:
    """Load seed catalogue keyed by destination name (fallback source).

    Lets trip export show attractions/hotels even when the DB row was
    seeded before those fields existed. Loaded lazily and cached.
    """
    global _SEED_PLACES
    if _SEED_PLACES is None:
        _SEED_PLACES = {}
        try:
            data_dir = Path(__file__).resolve().parent.parent.parent / "data"
            with (data_dir / "destinations.json").open(encoding="utf-8") as f:
                rows = json.load(f)
            _SEED_PLACES = {r["name"]: r for r in rows if r.get("name")}
        except OSError:
            _SEED_PLACES = {}
    return _SEED_PLACES


def _prepare_destination(destination: Destination | None) -> Destination | None:
    """Normalize JSON-string columns so the exporter sees Python lists.

    Falls back to the seed catalogue when the DB row has no
    attractions/hotels (e.g. seeded before those fields were added).
    """
    if destination is None:
        return None
    attractions = _as_list(destination.attractions)
    hotels = _as_list(destination.hotels)
    if (not attractions or not hotels) and destination.name:
        seed_row = _seed_places().get(destination.name) or {}
        if not attractions and isinstance(seed_row.get("attractions"), list):
            attractions = seed_row["attractions"]
        if not hotels and isinstance(seed_row.get("hotels"), list):
            hotels = seed_row["hotels"]
    destination.attractions = attractions
    destination.hotels = hotels
    return destination


def _serialize(t: Trip) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "end_date": t.end_date.isoformat() if t.end_date else None,
        "destination_id": t.destination_id,
        "notes": t.notes,
        "budget": t.budget,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.post("", response_model=TripSchema, status_code=status.HTTP_201_CREATED)
def create_trip(
    body: TripIn,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
):
    now = datetime.now(timezone.utc)
    trip = Trip(
        title=body.title,
        start_date=body.start_date,
        end_date=body.end_date,
        destination_id=body.destination_id,
        notes=body.notes,
        budget=body.budget,
        device_id=x_device_id or "default",
        created_at=now,
        updated_at=now,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return _serialize(trip)


@router.get("", response_model=list[TripSchema], status_code=status.HTTP_200_OK)
def list_trips(
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
):
    q = select(Trip)
    if x_device_id:
        q = q.where(Trip.device_id == x_device_id)
    trips = db.execute(q).scalars().all()
    return [_serialize(t) for t in trips]


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    db.delete(trip)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{trip_id}/export", status_code=status.HTTP_200_OK)
def export_trip(trip_id: int, db: Session = Depends(get_db)):
    """Export a trip as a single-file, shareable HTML itinerary.

    Loads the ``Trip`` (and its linked ``Destination``) and renders it via
    ``render_trip_html`` — a self-contained HTML document with Open Graph
    meta tags and a live countdown. Returns ``text/html``.
    """
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    destination: Destination | None = None
    if trip.destination_id is not None:
        destination = db.get(Destination, trip.destination_id)
    html = render_trip_html(trip, _prepare_destination(destination))
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
    )
