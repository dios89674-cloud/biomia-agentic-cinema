# System Architecture

Gemini agents, orchestrated via Google's Agent Development Kit (ADK, part of
the Gemini Enterprise Agent Platform), move a scene through a DAG-based film
production pipeline. Cloud Storage holds the real media payload; Firestore
holds only metadata and drives the Eventarc trigger; ClickHouse — queried
through its official MCP server — is the continuity fact-check layer.

```mermaid
%%{init: {"flowchart": {"subGraphTitleMargin": {"top": 12, "bottom": 12}, "nodeSpacing": 40, "rankSpacing": 55}}}%%
flowchart TD

    subgraph Client["Director's Suite (Web, Cloud Run)"]
        UI[Director Dashboard]
        Console[Director Console<br/>natural language commands]
    end

    subgraph Storage["GCP Storage Layer"]
        GCS[(Cloud Storage<br/>scripts, footage, storyboards,<br/>rendered assets)]
        Firestore[(Firestore<br/>metadata: scene status,<br/>agent state, file refs)]
    end

    Eventarc{{"Eventarc<br/>triggers on GCS upload /<br/>Firestore metadata change"}}

    subgraph AgentPlatform["Gemini Enterprise Agent Platform (Cloud Run)"]
        ADK["Agent Development Kit (ADK)<br/>multi-agent orchestration<br/>DAG-based: stage N+1 waits for N"]
        ScriptAgent[Script Agent]
        StoryboardAgent[Storyboard Agent]
        CastingAgent[Casting Agent]
        EditAgent[Editing Agent]
        VFXAgent[VFX Agent]
        ContinuityAgent["Continuity Agent<br/>veto power on<br/>continuity/budget conflicts"]
    end

    Gemini["Gemini 3.1 Pro/Flash<br/>via Agent Platform Model Garden"]

    subgraph MCPLayer["MCP Integration — ClickHouse Track"]
        MCPClient["MCP Client<br/>(inside Continuity Agent)"]
        MCPServer[["ClickHouse MCP Server<br/>mcp-clickhouse (official)<br/>list_tables · run_select_query"]]
        CH[(ClickHouse<br/>scene facts: props, wardrobe,<br/>timestamps — extracted per scene)]
    end

    ActionPlan[Approved Action / Alert]
    Notify[Notification to Director]

    %% Flow
    Console --> UI
    UI -->|upload script/footage| GCS
    UI -->|write intent| Firestore
    GCS --> Eventarc
    Firestore --> Eventarc
    Eventarc -->|wake, scale-to-zero| ADK

    ADK --> ScriptAgent
    ADK --> StoryboardAgent
    ADK --> CastingAgent
    ADK --> EditAgent
    ADK --> VFXAgent

    ScriptAgent --> Gemini
    StoryboardAgent --> Gemini
    CastingAgent --> Gemini
    EditAgent --> Gemini
    VFXAgent --> Gemini

    %% Vision/edit agents write extracted facts to ClickHouse for fast OLAP checks
    StoryboardAgent -->|writes scene facts| CH
    EditAgent -->|writes scene facts| CH

    %% Continuity Agent queries via real MCP protocol
    ADK --> ContinuityAgent
    ContinuityAgent --> MCPClient
    MCPClient -->|MCP protocol call| MCPServer
    MCPServer -->|run_select_query| CH
    CH -->|query results| MCPServer
    MCPServer -->|structured result| MCPClient
    MCPClient --> ContinuityAgent
    ContinuityAgent --> Gemini

    ContinuityAgent -->|approved| ActionPlan
    ContinuityAgent -.->|blocked: continuity break| Notify
    ActionPlan --> Firestore
    ActionPlan --> Notify
    Notify --> UI

    classDef client fill:#e0f7fa,stroke:#00acc1,color:#000;
    classDef storage fill:#fff3e0,stroke:#fb8c00,color:#000,stroke-width:2px;
    classDef trigger fill:#fff3e0,stroke:#fb8c00,color:#000;
    classDef platform fill:#ede7f6,stroke:#7e57c2,color:#000;
    classDef reasoning fill:#e8eaf6,stroke:#5c6bc0,color:#000;
    classDef mcp fill:#fce4ec,stroke:#c2185b,color:#000,stroke-width:2px;
    classDef arbiter fill:#ffebee,stroke:#e53935,color:#000,stroke-width:2px;
    classDef action fill:#e8f5e9,stroke:#43a047,color:#000;

    class UI,Console client;
    class GCS,Firestore storage;
    class Eventarc trigger;
    class ADK,ScriptAgent,StoryboardAgent,CastingAgent,EditAgent,VFXAgent platform;
    class Gemini reasoning;
    class MCPClient,MCPServer,CH mcp;
    class ContinuityAgent arbiter;
    class ActionPlan,Notify action;
```

## Key design decisions

- **DAG, not swarm.** Unlike a fan-out pattern where independent agents run
  in parallel, film production has real dependencies (you can't cast before
  a script exists). The ADK orchestrator only dispatches a stage once its
  prerequisite stage has written `status: complete` to Firestore.
- **Firestore never stores media.** It holds scene status, stage, and `gs://`
  references only. Cloud Storage holds scripts, footage, storyboards, and
  renders.
- **Eventarc, not polling.** The backend wakes only on a real Firestore
  write or Cloud Storage upload. Cloud Run scales to zero otherwise.
- **Real MCP usage, not a mention.** The Continuity Agent's only path to
  ClickHouse is the official `mcp-clickhouse` server, called via the MCP
  protocol from Python (`backend/services/mcp_clickhouse_client.py`) — see
  that file for the exact tool calls (`run_select_query`).
- **Safety-first arbitration.** The Continuity Agent can block an action
  outright if it finds a continuity mismatch or a VFX cost estimate that
  breaks budget — mirroring how a producer would actually intervene.
