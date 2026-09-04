# Travel Companion

A travel planning application that recommends destinations for holidays in Japan
and around the world, with holiday-type awareness (weekend / three_day / obon /
golden_week / custom). Trips can be exported as a single-file, shareable HTML
itinerary (Open Graph tags + live countdown).

## Monorepo layout

```
.
├── backend/             # FastAPI + SQLAlchemy service (Python)
│   ├── app/
│   │   ├── core/config.py    # env settings (AI_PROVIDER, DATABASE_URL)
│   │   ├── export/generator.py  # render_trip_html (single-file HTML export)
│   │   ├── reco/providers.py    # AI provider factory (rule / openai stub)
│   │   └── routers/            # FastAPI route modules
│   ├── data/            # destination seed JSON
│   └── tests/           # backend pytest suite
├── frontend/            # React + Vite + TypeScript client
├── docs/                # API contract (openapi.yaml) and design docs
└── backend/requirements.txt  # backend Python dependencies
```

## Run it in 5 steps

All commands are run from the **monorepo root** (`C:\Users\Lenovo\Documents\Default Project`).
The DB path `sqlite:///backend/data/app.db` is relative, so the backend must be
started from the root — not from inside `backend/`.

### 1. Install backend dependencies

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

(If you don't have a venv yet, create it once with
`python -m venv backend\.venv`.)

### 2. Seed the database

Creates the SQLite DB at `backend/data/app.db` and idempotently loads 62
destinations (incl. Kyoto/Osaka with attractions & hotels). Run from the
monorepo root (the DB path is relative to the CWD, so do **not** `cd` away):

```powershell
$env:PYTHONPATH="backend"
backend\.venv\Scripts\python.exe -m app.seed
```

(Or, equivalently: `cd backend; python -m app.seed`.)

### 3. Start the backend (FastAPI + Uvicorn)

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

- Health check: http://localhost:8000/health
- Interactive API docs: http://localhost:8000/docs

### 4. Install and start the frontend (React + Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/health` to
`http://localhost:8000`, so the UI talks to the backend with no extra CORS
setup.

### 5. Verify end-to-end

- The UI loads destinations, gets recommendations, and saves trips.
- Confirm backend tests: `backend\.venv\Scripts\python.exe -m pytest`
- Confirm frontend build + typecheck: `npm run build` in `frontend/`
  (runs `tsc -b && vite build`).

## Backend configuration

- **`AI_PROVIDER`** (default `rule`): selects the recommendation provider at
  runtime via `backend/app/core/config.py`.
  - `rule` — the deterministic, provider-agnostic recommendation engine
    (`backend/app/engine.py` exposed by `RuleProvider` in
    `backend/app/reco/providers.py`).
  - `openai` — stubbed. `OpenAIProvider` in `backend/app/reco/providers.py`
    raises `NotImplementedError` until the OpenAI SDK + API key are wired in
    (see its `TODO(T10)` note). Set the env var if you want to test the stub
    path, but keep `AI_PROVIDER=rule` (or unset) for normal use:
    ```powershell
    $env:AI_PROVIDER="rule"
    ```

## Sharing a trip as HTML

The backend export route `GET /api/trips/{id}/export` loads a trip (plus its
linked destination) and returns a **self-contained HTML** document via
`backend/app/export/generator.py:render_trip_html` with
`Content-Type: text/html; charset=utf-8`.

The exported page includes:

- **Open Graph / Twitter meta tags** (`og:title`, `og:description`, `twitter:card`, …)
  so shared links get rich link previews.
- A **live countdown** to the trip's end date (ticks every second in the page).
- A Leaflet map pin (when the destination has coordinates), booking links for
  transport / hotels / attractions, budget, notes, and an optional
  "next trip" teaser.

Open it directly in a browser from the Swagger docs, or via the frontend API
client (`api.exportTripUrl(id)`), then share/print the URL — no backend
session needed. Example with `curl` (from the monorepo root):

```powershell
curl.exe -i http://localhost:8000/api/trips/1/export
```

Returns `200` with `Content-Type: text/html; charset=utf-8` and the full page;
a missing trip id returns `404` JSON.

## Tests

```powershell
# backend
backend\.venv\Scripts\python.exe -m pytest

# frontend
cd frontend
npm run test
```

## API contract

The full API contract is frozen in [`docs/openapi.yaml`](docs/openapi.yaml).
