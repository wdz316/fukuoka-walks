"""POST /api/trips, GET /api/trips, DELETE /api/trips/{id},
GET /api/trips/{id}/export  (placeholder — T10 will add real export).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Trip
from app.schemas import Trip as TripSchema, TripIn

router = APIRouter(prefix="/api/trips", tags=["Trips"])


def _serialize(t: Trip) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "end_date": t.end_date.isoformat() if t.end_date else None,
        "destination_id": t.destination_id,
        "notes": t.notes,
        "budget": t.budget,
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
    """Placeholder — real HTML/markdown/ICS export will be wired by T10.

    Returns 404 JSON for a missing trip; otherwise a stub JSON payload
    indicating the feature is pending.
    """
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    return {
        "message": "Export not yet implemented (T10 placeholder)",
        "trip_id": trip_id,
    }
