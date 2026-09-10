from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import engine, run_migrations
from app.routers import destinations, preferences, recommendations, trips, visits


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

    return app


app = create_app()
