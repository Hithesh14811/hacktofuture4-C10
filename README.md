# Agenticzero Zero Trust Platform

Agenticzero is a hackathon-ready zero trust cloud console demo that combines:

- continuous post-login identity verification
- live behavioral telemetry and RL-ready scoring
- passkey and face-based step-up verification
- IAM blast radius analysis and remediation simulation
- real-time session trust updates over Socket.IO

Instead of trusting a user once at login, the platform keeps evaluating the session while the user is active in the console. Behavioral drift, new resources, unusual location context, privilege escalation attempts, and risky access patterns can push the session into challenge, restriction, or recovery flows without removing the existing rule-based safety controls.

## What the project currently includes

### Identity and trust layer

- Demo login for five seeded identities
- Persistent user records in `backend/data/users.json`
- Rule-based trust engine with passkey and face-verification thresholds
- Administrator-specific recovery workflow instead of normal re-entry
- Account restriction and restoration flows
- Real-time trust updates broadcast to the active session

### RL-ready behavioral scoring

- Live telemetry collection after login through `frontend/src/components/BehaviorMonitor.tsx`
- Default built-in RL-style scoring model in `backend/services/default_rl_model.py`
- Model loader/orchestrator in `backend/services/rl_model_service.py`
- Session overlay that shows live model score, risk, action, confidence, reasons, resources, and API activity
- Online profile/state persistence in:
  - `backend/data/behavior_profiles.json`
  - `backend/data/behavior_events.jsonl`
  - `backend/data/default_rl_model_state.json`

### IAM simulation and incident response

- Graph-backed IAM topology and blast-radius analysis
- Reachable-asset analysis, hops-to-admin, and critical path views
- Runtime access logging into the graph as users move through the product
- Incident response screen with live topology and remediation
- Remediation history and graph edge severing simulation

### Console experience

- Login page with demo-user picker and test login conditions
- Dashboard, Services, Secrets, Incident Response, Reports, Logs, and Admin pages
- Always-on RL overlay on authenticated pages except login
- Security overlays for passkey, face, and recovery enforcement
- Demo control panel for scenario injection during presentations

## How the system works

1. A user logs in with seeded credentials.
2. The backend creates a session and applies rule-based context checks like IP and location drift.
3. The frontend begins sending behavioral telemetry every few seconds after login.
4. The RL service converts telemetry plus session context into a live model score and action.
5. The trust engine blends that model assessment with the existing rule-based score.
6. Existing guardrails remain authoritative:
   - non-admin trust below `95`: passkey challenge
   - non-admin trust below `60`: face verification
   - admin trust below `95`: admin recovery workflow
7. Runtime access is also written into the IAM graph so the incident screen reflects what the session is actually touching.

## Behavioral signals currently monitored

- Keystroke activity, dwell, and flight timing
- Mouse movement volume, velocity, and curvature
- Click and scroll activity
- Route and resource novelty
- Device fingerprint, screen profile, and timezone consistency
- Access timing
- API activity
- Data read/write volume
- Privilege escalation attempts
- Network context from the trust engine

## Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Framer Motion
- Socket.IO client
- Zustand
- `@xyflow/react`
- `face-api.js`

### Backend

- FastAPI
- Pydantic v2
- Python Socket.IO
- NetworkX
- JWT auth via `python-jose`

### Deployment / local ops

- Docker Compose
- Nginx
- Uvicorn

## Repo layout

```text
hacktofuture4-C10/
|-- backend/
|   |-- data/
|   |-- models/
|   |-- routers/
|   |-- services/
|   |-- main.py
|   `-- realtime.py
|-- frontend/
|   |-- public/
|   |-- src/
|   `-- package.json
|-- docker-compose.yml
|-- Dockerfile.backend
|-- Dockerfile.frontend
`-- nginx.conf
```

## Key backend modules

- `backend/services/trust_engine.py`
  - session lifecycle
  - trust score updates
  - policy enforcement
  - access restriction and restoration
- `backend/services/rl_model_service.py`
  - model loading
  - observation building
  - profile persistence
  - learning hook integration
- `backend/services/default_rl_model.py`
  - default behavioral scoring model
- `backend/services/graph_service.py`
  - IAM graph state
  - blast-radius analysis
  - runtime access recording
- `backend/routers/auth.py`
  - login, logout, passkey, admin face skip
- `backend/routers/telemetry.py`
  - behavior telemetry ingestion
  - runtime access updates
  - model status endpoints
- `backend/routers/admin.py`
  - user/session admin operations
  - recovery voting
- `backend/routers/blast_radius.py`
  - graph and analysis endpoints

## Demo users

These demo credentials are currently wired into the backend:

| User | Role | Email | Password |
| --- | --- | --- | --- |
| Sarah Chen | Administrator | `sarah.chen@trustnet.corp` | `Admin@2024` |
| Vikram Nair | DevOps Engineer | `vikram.nair@trustnet.corp` | `DevOps@2024` |
| Priya Sharma | Developer | `priya.sharma@trustnet.corp` | `Dev@2024` |
| Rahul Mehta | Data Analyst | `rahul.mehta@trustnet.corp` | `Data@2024` |
| CI/CD Bot | Service Principal | `cicd.bot@trustnet.corp` | `Bot@2024` |

## Run locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on Vite and talks to the backend through `/api/...` routes. In container mode, Nginx fronts the built frontend and proxies the backend.

## Run with Docker

```bash
docker compose up --build
```

Default ports:

- frontend: `http://localhost:8080`
- backend: `http://localhost:8000`

## Health check

- Backend root: `GET /`
- Backend health: `GET /api/health`

Expected healthy response:

```json
{ "status": "healthy" }
```

## Main API groups

- `/api/auth`
- `/api/trust`
- `/api/face`
- `/api/admin`
- `/api/blast-radius`
- `/api/remediation`
- `/api/analyze`
- `/api/telemetry`

## Customizing or replacing the RL model

The app currently loads the default model from:

- `backend/services/default_rl_model.py`

The model loader lives in:

- `backend/services/rl_model_service.py`

The loader supports:

- `.py` modules exposing `predict(observation)`
- optional `learn(payload)`
- optional `save()` or `save_model()`
- `.pkl` / `.pickle` model objects with similar methods

The observation passed into the model includes:

- session context
- telemetry summary
- deviations from learned behavior
- novelty metrics
- device context
- profile sample count

The default integration is designed so you can swap in your own model without changing the rest of the app.

## Current product positioning

This is no longer just an IAM graph visualizer. The project now operates as a continuous identity assurance and incident response demo:

- login establishes identity
- trust and RL scoring keep validating that identity
- IAM topology shows what that identity can reach
- remediation contains the blast radius when a session becomes risky

## Notes

- Session, profile, and graph state are file-backed for demo persistence inside `backend/data/`
- The frontend includes a built production bundle in `frontend/dist/`
- The RL overlay is intentionally shown on authenticated pages only, not on the login page
