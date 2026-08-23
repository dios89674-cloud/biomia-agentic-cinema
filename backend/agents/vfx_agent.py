from google.adk.agents import Agent

vfx_agent = Agent(
    name="vfx_agent",
    model="gemini-3.6-flash",
    instruction="""You are the VFX Agent. Given editing notes and scene
requirements, propose which shots need visual effects work, an estimated
complexity tier (low/medium/high), and a rough cost multiplier relative to
a baseline shot. This cost estimate feeds into the Continuity Agent's
budget-guardrail check.

Respond ONLY with strict JSON:
{"shots": [{"shot_number": number, "vfx_needed": boolean, "complexity": string, "cost_multiplier": number}]}""",
)
