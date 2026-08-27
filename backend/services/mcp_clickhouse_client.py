"""
Real MCP client for the official ClickHouse MCP server (mcp-clickhouse).

This is intentionally NOT a raw clickhouse-connect call. The Continuity Agent
talks to ClickHouse through the official ClickHouse MCP server using the MCP
stdio transport. The server is installed in the same Python container, so this
works locally and on Cloud Run without requiring Docker-in-Docker.

Server source: https://github.com/ClickHouse/mcp-clickhouse
"""

import os
from contextlib import asynccontextmanager

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

_SERVER_PARAMS = StdioServerParameters(
    command="mcp-clickhouse",
    args=[],
    env={
        "CLICKHOUSE_HOST": os.environ.get("CLICKHOUSE_HOST", ""),
        "CLICKHOUSE_PORT": os.environ.get("CLICKHOUSE_PORT", "8443"),
        "CLICKHOUSE_USER": os.environ.get("CLICKHOUSE_USER", "default"),
        "CLICKHOUSE_PASSWORD": os.environ.get("CLICKHOUSE_PASSWORD", ""),
        "CLICKHOUSE_DATABASE": os.environ.get("CLICKHOUSE_DATABASE", "agentic_cinema"),
        "CLICKHOUSE_SECURE": os.environ.get("CLICKHOUSE_SECURE", "true"),
        "CLICKHOUSE_VERIFY": os.environ.get("CLICKHOUSE_VERIFY", "true"),
        "CLICKHOUSE_CONNECT_TIMEOUT": os.environ.get("CLICKHOUSE_CONNECT_TIMEOUT", "30"),
        "CLICKHOUSE_SEND_RECEIVE_TIMEOUT": os.environ.get("CLICKHOUSE_SEND_RECEIVE_TIMEOUT", "30"),
        "CLICKHOUSE_MCP_SERVER_TRANSPORT": "stdio",
    },
)


@asynccontextmanager
async def mcp_session():
    async with stdio_client(_SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def run_select_query(query: str) -> dict:
    """Calls the official run_query MCP tool on ClickHouse.
    This is the ONLY way the Continuity Agent reads scene facts.
    """
    async with mcp_session() as session:
        result = await session.call_tool("run_query", {"query": query})
        return result


def _extract_text(mcp_result) -> str:
    """MCP tool results come back as a list of content blocks; pull the
    text out of the first one. Defensive — different server versions may
    shape this slightly differently.
    """
    try:
        return mcp_result.content[0].text
    except (AttributeError, IndexError, TypeError):
        return str(mcp_result)


async def get_live_stats() -> dict:
    """Real aggregate queries against ClickHouse — this is the dashboard's
    'ClickHouse is actually doing something' proof, and it goes through the
    exact same MCP path the Continuity Agent uses. Not a simple row lookup:
    these are genuine GROUP BY / COUNT aggregations, the kind of query
    ClickHouse is actually built for.
    """
    total_raw = await run_select_query(
        "SELECT count() AS total FROM agentic_cinema.scene_facts"
    )
    by_stage_raw = await run_select_query(
        "SELECT stage, count() AS count FROM agentic_cinema.scene_facts "
        "GROUP BY stage ORDER BY count DESC"
    )
    recent_raw = await run_select_query(
        "SELECT scene_id, stage, recorded_at FROM agentic_cinema.scene_facts "
        "ORDER BY recorded_at DESC LIMIT 10"
    )

    return {
        "total": _extract_text(total_raw),
        "by_stage": _extract_text(by_stage_raw),
        "recent": _extract_text(recent_raw),
    }


async def list_tables(database: str) -> dict:
    async with mcp_session() as session:
        result = await session.call_tool("list_tables", {"database": database})
        return result
