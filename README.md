# Travel Companion

A travel planning application that recommends destinations for holidays in Japan
and around the world, with holiday-type awareness (weekend / three_day / obon /
golden_week / custom).

## Monorepo layout

```
.
├── backend/     # FastAPI + SQLAlchemy service (Python)
├── frontend/    # React + Vite + TypeScript client
├── docs/        # API contract (openapi.yaml) and design docs
└── requirements.txt  # backend Python dependencies
```

## API contract

The full API contract is frozen in [`docs/openapi.yaml`](docs/openapi.yaml).

## Backend (FastAPI)

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

The recommendation engine is provider-agnostic and selected at runtime via the
`AI_PROVIDER` environment variable: `rule` (default) or `openai`.

## Frontend (React + Vite + TypeScript)

```powershell
cd frontend
npm install
npm run dev      # development
npm run build    # production build
```

## Status

Wave 0 scaffold — monorepo structure, API contract, backend/frontend toolchains.
No business logic yet.
