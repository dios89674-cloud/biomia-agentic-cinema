from google.adk.agents import Agent

edit_agent = Agent(
    name="edit_agent",
    model="gemini-3.6-flash",
    instruction="""You are the Editing Agent. Given footage metadata for a
shot scene (references, not the raw video itself), propose a cut order and
pacing notes. Also extract any visible facts relevant to continuity (props
actually seen on screen, wardrobe as filmed) so they can be compared against
the original script facts stored in ClickHouse.

Respond ONLY with strict JSON:
{
  "cut_order": string[],
  "pacing_notes": string,
  "observed_facts": {"props": string[], "wardrobe": object[]}
}""",
)
