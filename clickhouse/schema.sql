-- Run this once against your ClickHouse instance before starting the backend.
-- The Continuity Agent reads from this table exclusively via the official
-- ClickHouse MCP server (see backend/services/mcp_clickhouse_client.py).

CREATE DATABASE IF NOT EXISTS agentic_cinema;

CREATE TABLE IF NOT EXISTS agentic_cinema.scene_facts
(
    scene_id      String,
    stage         String,       -- 'script' | 'storyboard' | 'edit'
    facts_json    String,       -- raw JSON blob: characters/props/wardrobe/location
    recorded_at   DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (scene_id, recorded_at);

-- Example query the Continuity Agent runs via MCP's run_select_query tool:
-- SELECT stage, facts_json, recorded_at
-- FROM agentic_cinema.scene_facts
-- WHERE scene_id = 'scene_12'
-- ORDER BY recorded_at ASC;
