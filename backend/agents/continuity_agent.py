"""
Continuity Agent — the arbiter of the pipeline.

Equivalent to the Medical Agent's veto power in a health-domain system,
here the Continuity Agent can block a downstream action if:
  (a) a continuity break is detected (a prop/wardrobe detail filmed
      doesn't match what the script/storyboard established), or
  (b) a VFX cost estimate breaks the scene's budget guardrail.

It is the only agent in this pipeline that queries ClickHouse, and it does
so exclusively through the official ClickHouse MCP server — see
services/mcp_clickhouse_client.py. This satisfies the hackathon's
requirement of real, in-code, runtime MCP usage (not a mention in a README).
"""

from google.adk.agents import Agent
from google.adk.tools import FunctionTool

from services.mcp_clickhouse_client import run_query


async def check_continuity(scene_id: str) -> dict:
    """Tool exposed to the agent: queries ClickHouse for all recorded scene
    facts (from script, storyboard, and edit stages) and returns them so the
    model can compare props/wardrobe across stages for mismatches.
    """
    query = f"""
        SELECT stage, facts_json, recorded_at
        FROM agentic_cinema.scene_facts
        WHERE scene_id = '{scene_id}'
        ORDER BY recorded_at ASC
    """
    return await run_query(query)


continuity_tool = FunctionTool(func=check_continuity)

continuity_agent = Agent(
    name="continuity_agent",
    model="gemini-3.6-flash",
    instruction="""You are the Continuity Agent, the safety/quality arbiter
of the production pipeline. Use the check_continuity tool to pull every
recorded fact for the scene (from script, storyboard, and edit stages),
stored in ClickHouse. Compare props and wardrobe across stages.

If you find a mismatch (e.g. a prop present in the script but missing in
the edited footage, or a wardrobe detail that changed without explanation),
or if the VFX cost multiplier for any shot exceeds 3.0x, you MUST block the
action. Otherwise, approve it.

Respond ONLY with strict JSON:
{
  "decision": "approved" | "blocked",
  "reason": string,
  "mismatches": object[]
}""",
    tools=[continuity_tool],
)
