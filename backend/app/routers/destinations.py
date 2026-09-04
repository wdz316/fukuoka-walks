"""GET /api/destinations (optional region + season filters)."""

from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Destination
from app.schemas import Destination as DestinationSchema

router = APIRouter(prefix="/api/destinations", tags=["Destinations"])

Season = Literal["spring", "summer", "autumn", "winter"]


def _serialize(row: Destination) -> dict:
    tags_raw = row.tags
    tags = json.loads(tags_raw) if isinstance(tags_raw, str) else (tags_raw or [])
    return {
        "id": row.id,
        "name": row.name,
        "country": row.country,
        "region": row.region,
        "description": row.description,
        "best_season": row.best_season,
        "tags": tags,
        "image_url": row.image_url,
    }


@router.get("", response_model=list[DestinationSchema], status_code=status.HTTP_200_OK)
def list_destinations(
    region: str | None = None,
    season: Season | None = None,
    db: Session = Depends(get_db),
):
    q = select(Destination)
    if region:
        q = q.where(Destination.region == region)
    if season:
        q = q.where(Destination.best_season == season)
    rows = db.execute(q).scalars().all()
    return [_serialize(r) for r in rows]
