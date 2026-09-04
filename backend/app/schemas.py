"""Pydantic schemas mirroring docs/openapi.yaml.

These models act as the contract boundary between the HTTP layer and the
recommendation engine. Field names and types follow the frozen OpenAPI spec
(components.schemas).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

HolidayType = Literal["weekend", "three_day", "obon", "golden_week", "custom"]
Season = Literal["spring", "summer", "autumn", "winter"]
AiProvider = Literal["rule", "openai"]


class Destination(BaseModel):
    """components.schemas.Destination."""

    id: int
    name: str
    country: str | None = None
    region: str | None = None
    description: str | None = None
    best_season: Season | None = None
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None


class Recommendation(BaseModel):
    """components.schemas.Recommendation."""

    destination: Destination
    score: float
    reason: str | None = None
    matched_interests: list[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    """components.schemas.RecommendRequest.

    `start_date` is required; `end_date` may be omitted when `holiday_type`
    fully determines the trip length (via ``app.reco.holidays.available_days``).
    """

    start_date: date
    end_date: date | None = None
    origin: str | None = None
    budget: float | None = None
    interests: list[str] = Field(default_factory=list)
    region: str | None = None
    holiday_type: HolidayType | None = None

    model_config = ConfigDict(extra="ignore")


class TripIn(BaseModel):
    """components.schemas.Trip minus server-assigned (read-only) fields."""

    title: str
    start_date: date
    end_date: date
    destination_id: int | None = None
    notes: str | None = None
    budget: float | None = None

    model_config = ConfigDict(extra="ignore")


class Trip(BaseModel):
    """components.schemas.Trip (full, including read-only server fields)."""

    id: int
    title: str
    start_date: date
    end_date: date
    destination_id: int | None = None
    notes: str | None = None
    budget: float | None = None
    created_at: datetime
    updated_at: datetime


class Preferences(BaseModel):
    """components.schemas.Preferences."""

    origin: str | None = None
    interests: list[str] = Field(default_factory=list)
    budget: float | None = None
    ai_provider: AiProvider | None = None

    model_config = ConfigDict(extra="ignore")


class Error(BaseModel):
    """components.schemas.Error."""

    detail: str