from fastapi import FastAPI

from app.routers import destinations, preferences, recommendations, trips


def create_app() -> FastAPI:
    app = FastAPI(title="Travel Companion API", version="0.1.0")

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(recommendations.router)
    app.include_router(trips.router)
    app.include_router(destinations.router)
    app.include_router(preferences.router)

    return app


app = create_app()
