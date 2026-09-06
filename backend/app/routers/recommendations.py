"""POST /api/recommend  and  POST /api/recommend/ai

Both share the same RecommendRequest schema.  The rule-based endpoint runs the
engine directly; the AI endpoint behaves identically today (future T10 will
swap in an LLM provider when available).
"""

from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.engine import recommend as engine_recommend
from app.models import Destination as DestDB, Preference as PrefDB, Trip
from app.reco.holidays import available_days
from app.routers.trips import _place_list, _seed_places
from app.schemas import RecommendRequest, Recommendation

router = APIRouter(prefix="/api/recommend", tags=["Recommendations"])


def _unscope_category(category: str) -> str:
    return category.split("::", 1)[1] if "::" in category else category


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _serialize_dest(db_row: DestDB) -> dict:
    tags_raw = db_row.tags
    tags = json.loads(tags_raw) if isinstance(tags_raw, str) else (tags_raw or [])
    attractions = _place_list(db_row.attractions)
    hotels = _place_list(db_row.hotels)
    if (not attractions or not hotels) and db_row.name:
        seed_row = _seed_places().get(db_row.name) or {}
        if not attractions and isinstance(seed_row.get("attractions"), list):
            attractions = _place_list(seed_row["attractions"])
        if not hotels and isinstance(seed_row.get("hotels"), list):
            hotels = _place_list(seed_row["hotels"])
    return {
        "id": db_row.id,
        "name": db_row.name,
        "country": db_row.country,
        "region": db_row.region,
        "description": db_row.description or "",
        "best_season": db_row.best_season,
        "tags": tags,
        "cost_level_1": db_row.cost_level_1 or 0,
        "cost_level_2": db_row.cost_level_2 or 0,
        "cost_level_3": db_row.cost_level_3 or 0,
        "cost_level_4": db_row.cost_level_4 or 0,
        "attractions": attractions,
        "hotels": hotels,
    }


def _build_recommendations(
    body: RecommendRequest,
    device_id: str | None,
    db: Session,
) -> list[Recommendation]:
    start_iso = body.start_date.isoformat()

    end_date_obj = body.end_date
    if end_date_obj is None:
        if body.holiday_type is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{"msg": "end_date or holiday_type is required"}],
            )
        days = available_days(start_iso, body.holiday_type)
        end_date_obj = body.start_date + timedelta(days=days - 1)

    filters: dict = {
        "start_date": start_iso,
        "end_date": end_date_obj.isoformat(),
    }
    if body.origin:
        filters["origin"] = body.origin
    if body.budget is not None:
        filters["budget"] = body.budget
    if body.interests:
        filters["interests"] = body.interests
    if body.region:
        filters["region"] = body.region
    if body.holiday_type:
        filters["holiday_type"] = body.holiday_type

    dest_rows = db.execute(select(DestDB)).scalars().all()
    destinations = [_serialize_dest(r) for r in dest_rows]
    # Full catalogue indexed by id so recommendations can carry
    # attractions/hotels/cost levels (the engine only scores on a subset).
    catalogue = {d["id"]: d for d in destinations}

    scope = device_id or "default"
    trip_rows = (
        db.execute(select(Trip).where(Trip.device_id == scope)).scalars().all()
    )
    history = [
        {"destination_id": t.destination_id, "end_date": t.end_date.isoformat()}
        for t in trip_rows
        if t.destination_id is not None
    ]

    pref_rows = db.execute(select(PrefDB)).scalars().all()
    preferences = [
        {
            "category": _unscope_category(p.category),
            "value": p.value,
            "weight": p.weight or 1.0,
        }
        for p in pref_rows
    ]

    raw_results = engine_recommend(
        destinations, filters, history or None, preferences or None
    )

    out: list[Recommendation] = []
    for r in raw_results:
        dest_data = r["destination"]
        full = catalogue.get(dest_data["id"], {})
        out.append(
            Recommendation(
                destination={
                    "id": dest_data["id"],
                    "name": dest_data["name"],
                    "country": dest_data.get("country"),
                    "region": dest_data.get("region"),
                    "description": dest_data.get("description"),
                    "best_season": dest_data.get("best_season"),
                    "tags": dest_data.get("tags", []),
                    "image_url": None,
                    "cost_level_1": full.get("cost_level_1"),
                    "cost_level_2": full.get("cost_level_2"),
                    "cost_level_3": full.get("cost_level_3"),
                    "cost_level_4": full.get("cost_level_4"),
                    "attractions": full.get("attractions", []),
                    "hotels": full.get("hotels", []),
                },
                score=r["score"],
                reason=r.get("reasons", [None])[0] if r.get("reasons") else None,
                matched_interests=r.get("matched_interests", []),
            )
        )
    return out


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post(
    "",
    response_model=list[Recommendation],
    status_code=status.HTTP_200_OK,
)
def recommend(
    body: RecommendRequest,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
):
    return _build_recommendations(body, x_device_id, db)


@router.post(
    "/ai",
    response_model=list[Recommendation],
    status_code=status.HTTP_200_OK,
)
def recommend_ai(
    body: RecommendRequest,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
):
    """AI-powered variant – currently identical to rule engine.

    When the openai provider is configured and available this will route
    through it; for now it falls back to the rule engine (T10 concern).
    """
    return _build_recommendations(body, x_device_id, db)
