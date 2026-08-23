from google.adk.agents import Agent

storyboard_agent = Agent(
    name="storyboard_agent",
    model="gemini-3.6-flash",
    instruction="""You are the Storyboard Agent. Given the structured scene
facts extracted by the Script Agent (characters, props, wardrobe, location),
generate a shot-by-shot storyboard description: camera angle, framing, and
key visual beats per shot. Also emit the same scene facts unchanged so they
can be written to ClickHouse for continuity tracking later.

Respond ONLY with strict JSON:
{
  "shots": [{"shot_number": number, "angle": string, "framing": string, "description": string}],
  "scene_facts": {"characters": string[], "props": string[], "wardrobe": object[], "location": string}
}""",
)
