"""
Pipeline Orchestrator — built on Google ADK (Agent Development Kit),
part of the Gemini Enterprise Agent Platform.

Unlike a fan-out swarm (all agents run at once, like Biomia's health
agents), film production has real dependencies: you can't cast actors
before the script exists, and you can't edit before footage exists.
This orchestrator is DAG-based: each stage only runs after its
prerequisite stage is present in the scene's completed_stages list.
"""

import json

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from services import firestore_client as fs
from services import clickhouse_writer
from agents.script_agent import script_agent
from agents.storyboard_agent import storyboard_agent
from agents.casting_agent import casting_agent
from agents.edit_agent import edit_agent
from agents.vfx_agent import vfx_agent
from agents.continuity_agent import continuity_agent

APP_NAME = "agentic_cinema"
DIRECTOR_USER_ID = "director"

# Stage -> (agent, prerequisite stage)
PIPELINE: list[tuple[str, Agent, str | None]] = [
    ("script", script_agent, None),
    ("storyboard", storyboard_agent, "script"),
    ("casting", casting_agent, "script"),
    ("edit", edit_agent, "shoot"),
    ("vfx", vfx_agent, "shoot"),
    ("continuity", continuity_agent, "edit"),
]

# ADK's Runner needs a session_service and an app_name at construction time.
# Best practice (per ADK docs/discussions) is to create these once and reuse
# them across requests rather than per-call — a fresh session is still
# created per invocation below, scoped to scene_id + stage.
_session_service = InMemorySessionService()
_runners: dict[str, Runner] = {
    stage_name: Runner(agent=agent, app_name=APP_NAME, session_service=_session_service)
    for stage_name, agent, _ in PIPELINE
}


def _prerequisite_met(scene: dict, prerequisite_stage: str | None) -> bool:
    if prerequisite_stage is None:
        return True
    return prerequisite_stage in scene.get("completed_stages", [])


async def _run_agent(stage_name: str, scene_id: str, input_text: str) -> str:
    """Runs one ADK agent to completion and returns its final text response."""
    session_id = f"{scene_id}_{stage_name}"
    await _session_service.create_session(
        app_name=APP_NAME, user_id=DIRECTOR_USER_ID, session_id=session_id
    )

    content = types.Content(role="user", parts=[types.Part(text=input_text)])
    runner = _runners[stage_name]

    final_response = ""
    async for event in runner.run_async(
        user_id=DIRECTOR_USER_ID, session_id=session_id, new_message=content
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_response = event.content.parts[0].text or ""

    return final_response


def _extract_facts(stage_name: str, result_text: str) -> dict:
    """Storyboard and Edit agents embed a facts object in their JSON output
    (under 'scene_facts' or 'observed_facts'). Best-effort parse — if the
    model didn't return clean JSON this stage, we just skip writing facts
    rather than crashing the whole pipeline over it.
    """
    key = {"storyboard": "scene_facts", "edit": "observed_facts"}.get(stage_name)
    if key is None:
        return {}
    try:
        cleaned = result_text.strip().removeprefix("```json").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        return parsed.get(key, {})
    except (json.JSONDecodeError, AttributeError):
        return {}


async def handle_state_change(scene_id: str) -> list[str]:
    """Entry point invoked by the Eventarc-triggered webhook (see main.py).

    Checks the DAG and runs every stage whose prerequisite is already in
    completed_stages and that hasn't itself completed yet. Returns the
    list of stages actually dispatched this call.
    """
    scene = fs.get_scene(scene_id)
    if scene is None:
        return []

    dispatched = []
    for stage_name, _agent, prerequisite in PIPELINE:
        # Re-fetch each iteration: an earlier stage in this same pass may
        # have just completed and unlocked this one.
        scene = fs.get_scene(scene_id)
        completed = scene.get("completed_stages", [])

        if stage_name in completed or not _prerequisite_met(scene, prerequisite):
            continue

        if stage_name == "continuity":
            # The Continuity Agent must call check_continuity(scene_id) with
            # the REAL scene_id, not a word it infers from the creative
            # script text (e.g. it once guessed 'alley' from "foggy alley"
            # instead of using the actual ID) — spell it out explicitly.
            stage_input = (
                f"The scene_id for this check is exactly: {scene_id}\n"
                f"Call the check_continuity tool with scene_id='{scene_id}' "
                f"(use this exact string, not a word from the script below).\n\n"
                f"Script context: {scene.get('script_text', '')}"
            )
        else:
            stage_input = scene.get("script_text") or f"Process scene {scene_id} for stage {stage_name}."

        result_text = await _run_agent(stage_name, scene_id, stage_input)

        facts = _extract_facts(stage_name, result_text)
        if facts:
            clickhouse_writer.write_scene_fact(scene_id, stage_name, facts)

        fs.mark_stage_complete(scene_id, stage_name, result=result_text)
        dispatched.append(stage_name)

    return dispatched
