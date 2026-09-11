"""User-created places (用户自建地点) endpoints.

GET/POST /api/spots — device-scoped places with coordinates (and optionally a
linked destination + description). POST /api/spots/photo stores a photo under
``backend/data/uploads`` and returns its public URL. DELETE /api/spots/{id}
removes a spot owned by the requesting device.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import Spot
from app.schemas import PhotoUpload, Spot as SpotSchema, SpotIn

router = APIRouter(prefix="/api/spots", tags=["Spots"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
_SUFFIX_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PHOTO_BYTES = 5 * 1024 * 1024


def _resolve_device(x_device_id: str | None, device_id: str | None = None) -> str:
    return (x_device_id or device_id) or "default"


def _serialize(s: Spot) -> dict:
    return {
        "id": s.id,
        "device_id": s.device_id,
        "destination_id": s.destination_id,
        "name": s.name,
        "lat": s.lat,
        "lng": s.lng,
        "description": s.description,
        "photo_url": s.photo_url,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("", response_model=list[SpotSchema], status_code=status.HTTP_200_OK)
def list_spots(
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
    destination_id: int | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    q = select(Spot).where(Spot.device_id == device)
    if destination_id is not None:
        q = q.where(Spot.destination_id == destination_id)
    spots = db.execute(q.order_by(Spot.id)).scalars().all()
    return [_serialize(s) for s in spots]


@router.post("", response_model=SpotSchema, status_code=status.HTTP_201_CREATED)
def create_spot(
    body: SpotIn,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    name = body.name.strip() or body.name
    spot = Spot(
        device_id=device,
        destination_id=body.destination_id,
        name=name,
        lat=body.lat,
        lng=body.lng,
        description=body.description,
        photo_url=body.photo_url,
        created_at=datetime.now(timezone.utc),
    )
    db.add(spot)
    db.commit()
    db.refresh(spot)
    return _serialize(spot)


@router.post("/photo", response_model=PhotoUpload, status_code=status.HTTP_201_CREATED)
async def upload_spot_photo(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be a jpg, png or webp image",
        )
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be a jpg, png or webp image",
        )
    contents = await file.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo is empty",
        )
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Photo too large (max 5MB)",
        )
    upload_dir = settings.UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = _SUFFIX_BY_TYPE.get(content_type) or suffix
    filename = f"{uuid4().hex}{ext}"
    (upload_dir / filename).write_bytes(contents)
    return PhotoUpload(url=f"/uploads/{filename}")


@router.delete("/{spot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spot(
    spot_id: int,
    db: Session = Depends(get_db),
    x_device_id: str | None = Header(default=None, alias="X-Device-Id"),
    device_id: str | None = Query(default=None),
):
    device = _resolve_device(x_device_id, device_id)
    spot = db.scalar(
        select(Spot).where(Spot.id == spot_id, Spot.device_id == device)
    )
    if spot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Spot not found",
        )
    db.delete(spot)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)