# 🎬 Agentic Cinema — Director's Suite

A DAG-based multi-agent production pipeline for film, built for the
**Lights. Camera. Code.** hackathon (Google Cloud, **ClickHouse** partner track).

Six Gemini agents — Script, Storyboard, Casting, Edit, VFX, and Continuity —
move a scene through a real dependency graph (you can't cast before a
script exists, can't edit before footage is shot). The **Continuity Agent**
has veto power: it queries ClickHouse — through the official ClickHouse
MCP server, not a raw SDK call — to catch continuity breaks (props/wardrobe
mismatches that changed between script, storyboard, and edit) before they
reach the director.

**Live demo:** https://agentic-cinema-frontend-427435661144.us-central1.run.app
**Backend health check:** https://agentic-cinema-backend-427435661144.us-central1.run.app/health

---

## What's actually running

| Component | Real, verified behavior |
|---|---|
| **Gemini** | `gemini-3.6-flash`, called via Google's Agent Development Kit (ADK) — not a raw API call |
| **Orchestration** | DAG-based, not a fan-out swarm — each stage waits on its real prerequisite |
| **State** | Firestore holds scene metadata + `completed_stages`; Cloud Storage holds footage; Firestore never stores binary media |
| **Triggers** | Two live Eventarc triggers: Cloud Storage `object.finalized` (footage upload → unlocks Edit/VFX) and Firestore `document.written` (any scene update → re-checks the DAG) |
| **ClickHouse** | Real writes from Storyboard/Edit agent output, real reads by the Continuity Agent — both via the official `mcp-clickhouse` MCP server |
| **Concurrency safety** | Firestore transactions atomically claim a stage before running it, preventing duplicate Gemini calls when overlapping Eventarc events fire for the same scene |

## Try it without installing anything

1. Open the live demo URL above.
2. Type a scene description into the Director Console, e.g.
   `"A masked thief cracks open a vault using a laser cutter, wearing an all-black stealth suit."`
3. Watch Script → Storyboard → Casting run in seconds, with real generated
   content (not just status text) appearing in the console.
4. Click any scene card to open its detail view — see the actual shots the
   Storyboard Agent wrote, casting suggestions, and (once a scene reaches
   Post-Prod) the Continuity Agent's real `approved`/`blocked` verdict.
5. Open the **ClickHouse** tab to see live aggregate stats — `count()`,
   `GROUP BY stage`, and the 10 most recent facts — polled every 8 seconds
   through the same MCP path the Continuity Agent uses.

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full diagram and design
rationale.

## Why this is event-driven, not always-on

Cloud Run scales to zero. Eventarc wakes the orchestrator only when
Firestore or Cloud Storage actually change — no server runs while nobody is
uploading footage. See [`infra/eventarc.md`](./infra/eventarc.md) for the
exact trigger configuration, including a documented gotcha: Firestore
Eventarc triggers always deliver their body as protobuf, never JSON — the
backend reads the changed document's ID from the `ce-subject` CloudEvents
header instead of parsing the body at all.

## Project structure

```
agentic-cinema/
├── frontend/             # React + Vite + Tailwind — Director Dashboard
│   └── src/components/
│       ├── DirectorDashboard.jsx    # main shell, tabs, real Firestore polling
│       ├── DirectorConsole.jsx      # chat UI with the "Gemini is thinking..." indicator
│       ├── PipelineBoard.jsx        # 4-column board, click a scene for detail
│       ├── PipelineOverview.jsx     # horizontal 6-stage strip with real counts
│       ├── SceneDetailModal.jsx     # shows real agent output, not raw JSON
│       ├── ClickHousePanel.jsx      # live aggregate stats via MCP
│       └── UploadFootage.jsx        # uploads to Cloud Storage, fires Eventarc
├── backend/              # FastAPI + Google ADK agents, deployed to Cloud Run
│   ├── main.py            # all endpoints: /commands, /scenes, /clickhouse/live,
│   │                         /eventarc/*, /scenes/{id}/footage, /scenes/{id}/rerun/{stage}
│   ├── agents/             # one file per agent
│   │   └── orchestrator.py  # the DAG + atomic stage-claiming logic
│   └── services/
│       ├── firestore_client.py       # scene state, transactional stage claims
│       ├── storage_client.py         # Cloud Storage uploads
│       ├── mcp_clickhouse_client.py  # the ONLY path to ClickHouse (agent reads + dashboard stats)
│       └── clickhouse_writer.py      # direct write path (plumbing, not agent reasoning)
├── clickhouse/           # schema.sql — run once against your instance
├── infra/                # Eventarc trigger setup, including the protobuf gotcha
├── ARCHITECTURE.md
└── LICENSE               # Apache 2.0
```

## Quickstart

### 1. ClickHouse

Run the schema once against your ClickHouse instance (ClickHouse Cloud or
self-hosted) — see [`clickhouse/schema.sql`](./clickhouse/schema.sql).

### 2. Backend

```bash
cd backend
cp .env.example .env   # fill in your GCP project, region, ClickHouse creds
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Deploy to Cloud Run:

```bash
gcloud run deploy agentic-cinema-backend --source . --region $GCP_REGION --allow-unauthenticated
```

Then set up both Eventarc triggers — see [`infra/eventarc.md`](./infra/eventarc.md).
**Important:** `.gcloudignore` in this folder excludes `.venv/` — without it,
`gcloud run deploy --source .` will upload hundreds of MB of local
dependencies and can break the build.

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # point VITE_API_BASE at your backend's .run.app URL
npm install
npm run dev             # local dev
```

Deploy to Cloud Run:

```bash
gcloud run deploy agentic-cinema-frontend --source . --region $GCP_REGION --allow-unauthenticated
```

**Important:** this folder needs its own `.gcloudignore` (excluding
`node_modules/` and `dist/`) — without it, a local `node_modules/` from
`npm run dev` gets uploaded and copied into the Docker build, colliding
with the fresh install and breaking `vite` inside the container. `.env` is
**not** excluded here (unlike the backend's) — Vite needs it at build time,
and it holds no secrets, just the public backend URL.

## Cleaning up test data

```bash
curl -X DELETE https://your-backend-url/scenes/{scene_id}
```

## Known limitations

- Edit and VFX agents reason over text metadata about the footage, not the
  actual video/image content — there's no computer-vision analysis of
  uploaded files in this version.
- Casting suggestions are archetypes (age range, build, traits) — there's
  no real talent database integration, and the Casting Agent says so
  explicitly rather than inventing names.
- No authentication — the API is open, appropriate for a hackathon demo,
  not for production use as-is.

## Partner track: ClickHouse

The Continuity Agent (`backend/agents/continuity_agent.py`) and the
dashboard's live stats panel are the **only** things that ever talk to
ClickHouse, and both go exclusively through the official ClickHouse MCP
server (`backend/services/mcp_clickhouse_client.py`) — real `run_query`
tool calls, not a decorative badge. Every scene fact written by the
Storyboard and Editing agents is queryable this way, which is what lets the
Continuity Agent catch mismatches across production stages — and what lets
the dashboard show genuine `count()` / `GROUP BY` aggregates updating live.

## License

Apache 2.0 — see [`LICENSE`](./LICENSE).
