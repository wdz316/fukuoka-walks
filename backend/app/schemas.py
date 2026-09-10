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


class StationInfo(BaseModel):
    """Nearest station for a transit leg (e.g. 祇園駅 on 地下鉄空港線)."""

    name: str
    line: str


class PlaceInfo(BaseModel):
    """A single attraction or hotel with coordinates and contact links."""

    name: str
    lat: float | None = None
    lng: float | None = None
    day: int | None = None
    url: str | None = None
    booking_url: str | None = None
    phone: str | None = None
    address: str | None = None
    station: StationInfo | None = None


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
    cost_level_1: int | None = None
    cost_level_2: int | None = None
    cost_level_3: int | None = None
    cost_level_4: int | None = None
    attractions: list[PlaceInfo] = Field(default_factory=list)
    hotels: list[PlaceInfo] = Field(default_factory=list)


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
    status: str = "planned"
    created_at: datetime
    updated_at: datetime


class Visit(BaseModel):
    """components.schemas.Visit — a single visited attraction (足迹)."""

    id: int
    device_id: str
    destination_id: int | None = None
    attraction_name: str
    visited_at: datetime


class VisitIn(BaseModel):
    """Request body for POST /api/visits."""

    destination_id: int | None = None
    attraction_name: str
    visited_at: datetime | None = None

    model_config = ConfigDict(extra="ignore")


class TripCompleteIn(BaseModel):
    """Request body for POST /api/trips/{id}/complete."""

    stops: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


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