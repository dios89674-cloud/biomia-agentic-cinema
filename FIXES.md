# Clean configuration fixes

1. Fixed `google-adk==1.2.0` vs `mcp==1.2.0` dependency conflict by requiring MCP >=1.8,<2.
2. Added official `mcp-clickhouse==0.4.1`.
3. Replaced Docker-in-Docker MCP startup with the installed `mcp-clickhouse` executable over stdio.
4. Updated the ClickHouse MCP tool call from legacy `run_select_query` to the current `run_query`.
5. Standardized the project runtime on Python 3.12, matching the backend container.
6. Added `SETUP.md` for a clean local setup and Cloud Run path.
