# 🎬 Agentic Cinema — Director's Suite

A DAG-based multi-agent production pipeline for film, built for the
**Lights. Camera. Code.** hackathon (Google Cloud, ClickHouse partner track).

Gemini agents (via Google's Agent Development Kit, part of the Gemini
Enterprise Agent Platform) move a scene through Script → Pre-Production →
Shoot → Post-Production. A dedicated **Continuity Agent** has veto power: it
queries ClickHouse — through the official ClickHouse MCP server, not a raw
SDK call — to catch continuity breaks (props/wardrobe mismatches) or
budget-busting VFX estimates before they reach the director.

**Live demo:** `https://agentic-cinema-frontend-xxxxx.run.app` *(fill in after deploy)*
**Backend health check:** `https://agentic-cinema-backend-xxxxx.run.app/health`

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full diagram and design
rationale — including how Gemini connects to the backend, where state lives
(Firestore for metadata, Cloud Storage for media, ClickHouse for continuity
facts), and exactly how the ClickHouse MCP integration works.

## Why this is event-driven, not always-on

Cloud Run scales to zero. Eventarc wakes the orchestrator only when
Firestore or Cloud Storage actually change — no server runs while nobody is
uploading footage. See [`infra/eventarc.md`](./infra/eventarc.md) for the
exact trigger configuration.

## Project structure

```
agentic-cinema/
├── frontend/          # React + Vite + Tailwind — Director Dashboard
├── backend/            # FastAPI + Google ADK agents, deployed to Cloud Run
│   ├── agents/          # One file per agent (script, storyboard, casting,
│   │                       edit, vfx, continuity)
│   └── services/        # Firestore, Cloud Storage, ClickHouse MCP clients
├── clickhouse/          # schema.sql — run once against your instance
├── infra/                # Eventarc trigger setup
├── ARCHITECTURE.md
└── LICENSE               # Apache 2.0
```

## Quickstart

### 1. ClickHouse

```bash
# Run once against your ClickHouse instance (ClickHouse Cloud or self-hosted)
clickhouse-client < clickhouse/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in your GCP project, region, ClickHouse creds
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Deploy to Cloud Run:

```bash
gcloud run deploy agentic-cinema-backend --source . --region $GCP_REGION
```

Then set up the Eventarc trigger — see [`infra/eventarc.md`](./infra/eventarc.md).

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # point VITE_API_BASE at your backend's .run.app URL
npm install
npm run dev             # local dev
```

Deploy to Cloud Run:

```bash
npm run build
gcloud run deploy agentic-cinema-frontend --source . --region $GCP_REGION
```

## Partner track: ClickHouse

The Continuity Agent (`backend/agents/continuity_agent.py`) is the only
agent that talks to ClickHouse, and it does so exclusively through the
**official ClickHouse MCP server** (`backend/services/mcp_clickhouse_client.py`),
using the real `run_query` tool — not a decorative dashboard stat. The MCP
server runs as a local child process inside the same application container,
so the Cloud Run deployment does not require Docker-in-Docker.
Every scene fact written by the Storyboard and Editing agents is queryable
this way, which is what lets the Continuity Agent catch mismatches across
production stages fast, at scale — ClickHouse's actual strength.

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).
