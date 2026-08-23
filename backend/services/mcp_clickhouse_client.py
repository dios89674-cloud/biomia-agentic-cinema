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


async def run_query(query: str) -> dict:
    """Calls the official run_query MCP tool on ClickHouse.
    This is the ONLY way the Continuity Agent reads scene facts.
    """
    async with mcp_session() as session:
        result = await session.call_tool("run_query", {"query": query})
        return result


async def list_tables(database: str) -> dict:
    async with mcp_session() as session:
        result = await session.call_tool("list_tables", {"database": database})
        return result
