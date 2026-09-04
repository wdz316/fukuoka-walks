"""GET /api/preferences  and  PUT /api/preferences.

Preferences are stored as (category, value, weight) rows and aggregated back
into the openapi ``Preferences`` shape.  Scoped by device id when provided.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Preference
from app.schemas import Preferences

router = APIRouter(prefix="/api/preferences", tags=["Preferences"])


def _scope(device_id: str | None) -> str:
    return device_id or "default"


def _load_preferences(device_id: str | None, db: Session) -> Preferences:
    scope = _scope(device_id)
    rows = db.execute(
        select(Preference).where(Preference.category.like(f"{scope}::%"))
    ).scalars().all()

    by_key: dict[str, list[str]] = {}
    for row in rows:
        key = row.category.split("::", 1)[1]
        by_key.setdefault(key, []).append(row.value)

    def _first(key: str) -> str | None:
        vals = by_key.get(key)
        return vals[0] if vals else None

    interests = by_key.get("interest", [])
    budget_val = _first("budget")
    budget = float(budget_val) if budget_val is not None else None

    ai_provider = _first("ai_provider")
    return Preferences(
        origin=_first("origin"),
        interests=interests,
        budget=budget,
        ai_provider=ai_provider if ai_provider in ("rule", "openai") else None,
    )


def _save_preferences(
    prefs: Preferences, device_id: str | None, db: Session
) -> Preferences:
    scope = _scope(device_id)
    db.execute(
        delete(Preference).where(Preference.category.like(f"{scope}::%"))
    )

    def add(key: str, value: str, weight: float | None = None) -> None:
        db.add(
            Preference(
                category=f"{scope}::{key}",
                value=value,
                weight=weight,
            )
        )

    if prefs.origin:
        add("origin", prefs.origin)
    for interest in prefs.interests:
        add("interest", interest, weight=1.0)
    if prefs.budget is not None:
        add("budget", str(prefs.budget), weight=1.0)
    if prefs.ai_provider:
        add("ai_provider", prefs.ai_provider)

    db.commit()
    return _load_preferences(device_id, db)


@router.get("", response_model=Preferences, status_code=status.HTTP_200_OK)
def get_preferences(
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    db: Session = Depends(get_db),
):
    return _load_preferences(x_device_id, db)


@router.put("", response_model=Preferences, status_code=status.HTTP_200_OK)
def upsert_preferences(
    body: Preferences,
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    db: Session = Depends(get_db),
):
    return _save_preferences(body, x_device_id, db)
