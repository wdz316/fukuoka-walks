"""Footprint (足迹) endpoints.

GET/POST/DELETE /api/visits — device-scoped records of visited attractions.
POST /api/trips/{id}/complete — mark a trip done and record its stops as
visits (idempotent: same device + same attraction name is not duplicated).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Trip, Visit
from app.routers.trips import _serialize as serialize_trip
from app.schemas import Trip as TripSchema, TripCompleteIn, Visit as VisitSchema, VisitIn

router = APIRouter(prefix="/api", tags=["Visits"])


def _resolve_device(x_device_id: str | None, device_id: str | None = None) -> str:
    return (x_device_id or device_id) or "default"


def _serialize(v: Visit) -> dict:
    return {
        "id": v.id,
        "device_id": v.device_id,
        "destination_id": v.destination_id,
        "attraction_name": v.attraction_name,
        "visited_at": v.visited_at.isoformat() if v.visited_at else None,
    }


@router.get("/visits", response_model=list[VisitSchema], status_code=status.HTTP_200_OK)
def list_visits(
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    rows = db.execute(
        select(Visit).where(Visit.device_id == device).order_by(Visit.id)
    ).scalars().all()
    return [_serialize(v) for v in rows]


@router.post("/visits", response_model=VisitSchema, status_code=status.HTTP_201_CREATED)
def create_visit(
    body: VisitIn,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    name = body.attraction_name.strip() or body.attraction_name
    visit = Visit(
        device_id=device,
        destination_id=body.destination_id,
        attraction_name=name,
        visited_at=body.visited_at or datetime.now(timezone.utc),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return _serialize(visit)


@router.delete("/visits/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    visit = db.scalar(
        select(Visit).where(Visit.id == visit_id, Visit.device_id == device)
    )
    if visit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found",
        )
    db.delete(visit)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/trips/{trip_id}/complete", response_model=TripSchema, status_code=status.HTTP_200_OK)
def complete_trip(
    trip_id: int,
    body: TripCompleteIn,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    """Mark a trip done and record its stops as visits.

    Idempotent: a stop already visited by the same device is skipped, and a
    trip that is already ``done`` may be re-completed without side effects.
    """
    device = _resolve_device(x_device_id, device_id)
    trip = db.get(Trip, trip_id)
    if trip is None or (trip.device_id and trip.device_id != device):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )
    now = datetime.now(timezone.utc)
    visited_names = set(
        db.scalars(
            select(Visit.attraction_name).where(Visit.device_id == device)
        ).all()
    )
    for raw in body.stops:
        name = raw.strip()
        if not name or name in visited_names:
            continue
        db.add(
            Visit(
                device_id=device,
                destination_id=trip.destination_id,
                attraction_name=name,
                visited_at=now,
            )
        )
        visited_names.add(name)
    trip.status = "done"
    trip.updated_at = now
    db.commit()
    db.refresh(trip)
    return serialize_trip(trip)