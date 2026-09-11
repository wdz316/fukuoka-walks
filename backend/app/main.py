from contextlib import asynccontextmanager
from pathlib import Path
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import engine, run_migrations
from app.routers import destinations, preferences, recommendations, spots, trips, visits

# Vite build output (frontend/dist). Absent in dev/test checkouts where only
# `npm run dev` is used — the app then serves API only.
# main.py lives at backend/app/main.py, so repo root is three levels up.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


# Reserved prefixes that must never fall through to the SPA shell.
_RESERVED_PREFIXES = ("api/", "uploads/", "docs", "redoc", "openapi.json", "health")


def _resolve_frontend_file(root: Path, request_path: str) -> Path | None:
    """Resolve a static file under the Vite dist directory, or None.

    Returns None when the build is absent, the path escapes the dist root,
    or the path is not a regular file. Directories intentionally fall
    through to the SPA shell (except the dist root itself, which serves
    ``index.html``).
    """
    index = root / "index.html"
    if not index.is_file():
        return None
    normalized = request_path.strip("/")
    if not normalized:
        return index
    candidate = (root / normalized).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


def _mount_frontend(app: FastAPI) -> None:
    """Serve the Vite SPA from the same origin when a build is present.

    Registered after all API routers and mounts, so ``/api/*``, ``/uploads``,
    ``/health`` and the FastAPI docs keep working. Unknown non-API paths fall
    back to ``index.html`` for React Router deep links such as ``/plan``.
    """
    if not (FRONTEND_DIST / "index.html").is_file():
        return

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend_spa(full_path: str):
        if full_path == "" or full_path == "/":
            return FileResponse(str(FRONTEND_DIST / "index.html"))
        if full_path == "index.html" or full_path.startswith(_RESERVED_PREFIXES):
            raise HTTPException(status_code=404)
        resolved = _resolve_frontend_file(FRONTEND_DIST, full_path)
        if resolved is not None:
            return FileResponse(str(resolved))
        return FileResponse(str(FRONTEND_DIST / "index.html"))


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        run_migrations(engine)
        yield

    app = FastAPI(title="Travel Companion API", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/version", include_in_schema=False)
    def version() -> dict[str, str]:
        """Deployed commit SHA for version checks (Render injects RENDER_GIT_COMMIT)."""
        sha = os.environ.get("RENDER_GIT_COMMIT") or os.environ.get("GIT_SHA", "dev")
        return {"sha": sha[:12]}

    app.include_router(recommendations.router)
    app.include_router(trips.router)
    app.include_router(destinations.router)
    app.include_router(preferences.router)
    app.include_router(visits.router)
    app.include_router(spots.router)

    upload_dir = settings.UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    _mount_frontend(app)

    return app


app = create_app()
