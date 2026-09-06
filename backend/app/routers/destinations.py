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
from app.routers.trips import _place_list, _seed_places

router = APIRouter(prefix="/api/destinations", tags=["Destinations"])

Season = Literal["spring", "summer", "autumn", "winter"]


def _place_list(raw) -> list[dict]:
    if not raw:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
        items = parsed if isinstance(parsed, list) else []
    else:
        return []
    return [i for i in items if isinstance(i, dict) and i.get("name")]


def _serialize(row: Destination) -> dict:
    tags_raw = row.tags
    tags = json.loads(tags_raw) if isinstance(tags_raw, str) else (tags_raw or [])
    places = _seed_places()
    attractions = _place_list(row.attractions)
    hotels = _place_list(row.hotels)
    if (not attractions or not hotels) and row.name:
        seed_row = places.get(row.name) or {}
        if not attractions and isinstance(seed_row.get("attractions"), list):
            attractions = _place_list(seed_row["attractions"])
        if not hotels and isinstance(seed_row.get("hotels"), list):
            hotels = _place_list(seed_row["hotels"])
    return {
        "id": row.id,
        "name": row.name,
        "country": row.country,
        "region": row.region,
        "description": row.description,
        "best_season": row.best_season,
        "tags": tags,
        "image_url": row.image_url,
        "cost_level_1": row.cost_level_1,
        "cost_level_2": row.cost_level_2,
        "cost_level_3": row.cost_level_3,
        "cost_level_4": row.cost_level_4,
        "attractions": attractions,
        "hotels": hotels,
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
