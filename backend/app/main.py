from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import engine, run_migrations
from app.routers import destinations, preferences, recommendations, spots, trips, visits


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        run_migrations(engine)
        yield

    app = FastAPI(title="Travel Companion API", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(recommendations.router)
    app.include_router(trips.router)
    app.include_router(destinations.router)
    app.include_router(preferences.router)
    app.include_router(visits.router)
    app.include_router(spots.router)

    upload_dir = settings.UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    return app


app = create_app()
