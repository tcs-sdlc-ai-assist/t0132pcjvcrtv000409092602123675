# Meridian Care Console

Meridian Care Console is a staff-only care-management workspace for reviewing assigned members, documenting care work, and monitoring operational follow-up.

## Development

### Backend

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
DATABASE_URL=sqlite+aiosqlite:///./data/meridian.db .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

The backend creates its file-backed SQLite schema and seeds demo data at startup. Configure `DATABASE_URL`, `JWT_SECRET`, and `SEED_ON_STARTUP` from `backend/.env.example` for a local environment.

### Frontend

```bash
cd frontend
npm install
node node_modules/vite/bin/vite.js dev
```

The Vite development server proxies `/api` to the backend. Production client requests are same-origin, so deploy the frontend behind an API-capable ingress or use a separate API routing layer.

## Demo users

All demonstration accounts use password `CareDemo1!`:

- `coordinator@example.com` — coordinator, restricted to assigned panel members.
- `supervisor@example.com` — supervisor, can oversee all members and assign care work.
- `auditor@example.com` — auditor, has read-only access across all members.

## Tests

```bash
cd backend && PYTHONPATH=. $HOME/venvs/meridian/bin/python -m pytest tests/test_dashboard_api.py tests/test_integration_flow.py -q
cd frontend && node node_modules/vitest/vitest.mjs run src/pages/DashboardPage.test.tsx --environment jsdom
cd frontend && node node_modules/vite/bin/vite.js build
```

Playwright dashboard coverage is authored in `frontend/e2e/dashboard.spec.ts`. Run it against live backend and frontend servers with the frontend-local configuration when browser testing is desired.

## Two-container deployment

The deployment uses exactly two services: `backend` (FastAPI on port 8000) and `frontend` (nginx SPA hosting on port 80). No database container is required: the backend writes its SQLite file at `/tmp/meridian/app.db` by default. Set `DATABASE_URL`, `JWT_SECRET`, `BACKEND_PORT`, and `FRONTEND_PORT` through the environment before deploying with Compose.

SQLite persistence is file-backed within the backend container. For durable production retention, mount or otherwise provision persistent storage for the SQLite path appropriate to the deployment platform.

## Privacy and license

This repository contains synthetic demonstration data only. Treat the application as an internal authorized-care tool and do not place protected health information in logs or source control.

This software is private and proprietary. No license to copy, distribute, or modify is granted.
