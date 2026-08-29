# System Architecture

Gemini agents, orchestrated via Google's Agent Development Kit (ADK, part of
the Gemini Enterprise Agent Platform), move a scene through a DAG-based film
production pipeline. Cloud Storage holds the real media payload; Firestore
holds only metadata and drives two Eventarc triggers; ClickHouse — queried
and written exclusively through its official MCP server — is the
continuity fact-check layer and the dashboard's live analytics source.

```mermaid
%%{init: {"flowchart": {"subGraphTitleMargin": {"top": 12, "bottom": 12}, "nodeSpacing": 40, "rankSpacing": 55}}}%%
flowchart TD

    subgraph Client["Director's Suite (React, Cloud Run)"]
        UI[Director Dashboard]
        Console[Director Console<br/>shows real agent output, not just status]
        Upload[Upload Footage panel]
        CHPanel[ClickHouse Live panel<br/>polls every 8s]
    end

    subgraph Storage["GCP Storage Layer"]
        GCS[(Cloud Storage<br/>footage/scene_id/filename)]
        Firestore[(Firestore<br/>completed_stages · processing_stages<br/>results · script_text)]
    end

    EventarcGCS{{"Eventarc<br/>Storage object.finalized"}}
    EventarcFS{{"Eventarc<br/>Firestore document.written<br/>body: protobuf — read via ce-subject header"}}

    subgraph Backend["Cloud Run Backend (FastAPI)"]
        Orchestrator{{"DAG Orchestrator<br/>atomic stage-claiming via<br/>Firestore transactions"}}
        Script[Script Agent]
        Storyboard[Storyboard Agent]
        Casting[Casting Agent]
        Edit[Edit Agent]
        VFX[VFX Agent]
        Continuity["Continuity Agent<br/>veto power"]
    end

    Gemini["Gemini 3.6 Flash<br/>via ADK Runner"]

    subgraph MCP["ClickHouse — MCP only, no other path"]
        MCPClient["MCP Client<br/>(mcp_clickhouse_client.py)"]
        MCPServer[["Official mcp-clickhouse server<br/>run_query tool"]]
        CH[(ClickHouse<br/>scene_facts: scene_id, stage,<br/>facts_json, recorded_at)]
    end

    Writer["clickhouse_writer.py<br/>direct HTTP write<br/>(plumbing, not agent reasoning)"]

    %% Client to backend
    Console -->|POST /commands| Orchestrator
    Upload -->|footage file| GCS
    CHPanel -->|GET /clickhouse/live| MCPClient

    %% Event wiring
    GCS --> EventarcGCS --> Orchestrator
    Firestore --> EventarcFS --> Orchestrator

    %% DAG execution
    Orchestrator -->|claim stage, then run| Script
    Orchestrator -->|claim stage, then run| Storyboard
    Orchestrator -->|claim stage, then run| Casting
    Orchestrator -->|claim stage, then run| Edit
    Orchestrator -->|claim stage, then run| VFX
    Orchestrator -->|claim stage, then run| Continuity

    Script --> Gemini
    Storyboard --> Gemini
    Casting --> Gemini
    Edit --> Gemini
    VFX --> Gemini
    Continuity --> Gemini

    Storyboard -.->|scene_facts| Writer
    Edit -.->|observed_facts| Writer
    Writer --> CH

    Continuity -->|real scene_id, explicit in prompt| MCPClient
    MCPClient --> MCPServer --> CH

    Orchestrator -->|mark_stage_complete| Firestore

    classDef client fill:#e0f7fa,stroke:#00acc1,color:#000;
    classDef storage fill:#fff3e0,stroke:#fb8c00,color:#000,stroke-width:2px;
    classDef trigger fill:#fff3e0,stroke:#fb8c00,color:#000;
    classDef backend fill:#ede7f6,stroke:#7e57c2,color:#000;
    classDef reasoning fill:#e8eaf6,stroke:#5c6bc0,color:#000;
    classDef mcp fill:#fce4ec,stroke:#c2185b,color:#000,stroke-width:2px;

    class UI,Console,Upload,CHPanel client;
    class GCS,Firestore storage;
    class EventarcGCS,EventarcFS trigger;
    class Orchestrator,Script,Storyboard,Casting,Edit,VFX,Continuity backend;
    class Gemini reasoning;
    class MCPClient,MCPServer,CH,Writer mcp;
```

## Key design decisions

- **DAG, not swarm.** Storyboard and Casting only need `script` complete;
  Edit and VFX need `shoot` complete; Continuity needs `edit` complete. The
  orchestrator re-checks `completed_stages` on every invocation rather than
  assuming a linear order.
- **Firestore never stores media.** It holds scene status and `gs://`
  references only. Cloud Storage holds scripts, footage, storyboards, and
  renders.
- **Two Eventarc triggers, one gotcha.** The Cloud Storage trigger delivers
  a normal JSON body. The Firestore trigger does not — Firestore Eventarc
  events are always protobuf, and Google's API rejects
  `--event-data-content-type=application/json` outright for this event
  type. The backend sidesteps this entirely: it never parses the event
  body, it reads the changed document's ID from the `ce-subject` CloudEvents
  header (always plain text, regardless of body content type), then
  re-reads fresh state from Firestore itself.
- **Atomic stage claiming.** Because the orchestrator's own writes
  (`mark_stage_complete`) re-trigger the Firestore Eventarc trigger, two
  overlapping invocations can otherwise both see a stage as "not done yet"
  and both run it — wasting Gemini quota and writing duplicate ClickHouse
  rows. A Firestore transaction (`try_claim_stage`) makes the
  check-and-claim atomic across concurrent Cloud Run instances, not just
  within one process.
- **ClickHouse access has exactly one path.** Every read (Continuity
  Agent's reasoning, the dashboard's live stats) goes through the official
  `mcp-clickhouse` MCP server — real `run_query` tool calls, not a
  decorative badge. Writing scene facts in the first place is ordinary
  pipeline plumbing (`clickhouse_writer.py`), done via direct HTTP rather
  than routed through a read-oriented MCP server.
- **The Continuity Agent needs its real scene_id spelled out.** Early on,
  the agent inferred a scene_id-shaped word from the creative script text
  (e.g. guessing `'alley'` from "foggy alley") instead of using the actual
  ID, silently returning empty/meaningless query results. The fix: the
  orchestrator explicitly states the real `scene_id` in the prompt for this
  stage, rather than relying on the model to extract it correctly.
- **Agents fail honestly, not creatively.** If given non-scene input (e.g.
  a meta-question typed into the console by mistake), the Storyboard Agent
  is instructed to say so rather than hallucinate a fictional scene — matching
  how the Script and Casting agents already behaved.
- **Auxiliary writes never crash the pipeline.** A ClickHouse write timeout
  is caught and logged, not allowed to fail the whole request — the
  creative work (Gemini's output) already succeeded and should still be
  marked complete.
