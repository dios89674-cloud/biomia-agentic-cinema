"""
Direct write path to ClickHouse for pipeline data.

This is intentionally NOT routed through MCP. The MCP server
(services/mcp_clickhouse_client.py) is how the Continuity Agent *reasons*
about scene facts — that's the part relevant to the hackathon's MCP
requirement. Writing the facts in the first place is ordinary pipeline
plumbing, so a direct HTTP call to ClickHouse is simpler and more honest
than routing a write through a read-oriented MCP server.
"""

import os
import json
import urllib.request
import urllib.parse


def _clickhouse_url() -> str:
    host = os.environ["CLICKHOUSE_HOST"]
    port = os.environ.get("CLICKHOUSE_PORT", "8443")
    return f"https://{host}:{port}"


def write_scene_fact(scene_id: str, stage: str, facts: dict) -> None:
    """Inserts one row into agentic_cinema.scene_facts. Silently no-ops
    if `facts` is empty — not every stage produces comparable facts.
    """
    if not facts:
        return

    facts_json = json.dumps(facts).replace("'", "''")
    query = (
        f"INSERT INTO agentic_cinema.scene_facts (scene_id, stage, facts_json) "
        f"VALUES ('{scene_id}', '{stage}', '{facts_json}')"
    )

    user = os.environ.get("CLICKHOUSE_USER", "default")
    password = os.environ.get("CLICKHOUSE_PASSWORD", "")
    auth = f"{user}:{password}"

    req = urllib.request.Request(
        _clickhouse_url(),
        data=query.encode("utf-8"),
        method="POST",
    )
    req.add_header(
        "Authorization",
        "Basic " + __import__("base64").b64encode(auth.encode()).decode(),
    )

    with urllib.request.urlopen(req, timeout=20) as resp:
        resp.read()
