"""
FastAPI service deployed on Cloud Run.

Two entry points:
  POST /eventarc/scene-updated  — invoked by Eventarc when Firestore or
                                   Cloud Storage changes (see infra/eventarc.md)
  POST /commands                — invoked by the Director Console (frontend)
                                   for natural-language commands

Deploy with: gcloud run deploy agentic-cinema-backend --source .
"""

import os
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from agents.orchestrator import handle_state_change
from services import firestore_client as fs

load_dotenv()

app = FastAPI(title="Agentic Cinema — Backend")

# Allow the frontend (deployed on a different Cloud Run domain) to call this
# API from the browser. Tighten allow_origins to your exact frontend URL
# before final submission if you want to lock this down.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agentic-cinema-backend"}


@app.get("/scenes")
async def list_scenes():
    """Returns all scenes with their pipeline progress, for the frontend's
    Pipeline board. Maps internal stage names to the four UI columns.
    """
    scenes = fs.list_all_scenes()
    result = []
    for scene in scenes:
        completed = scene.get("completed_stages", [])
        ui_stage = _map_to_ui_column(completed)
        result.append({
            "id": scene.get("id"),
            "title": scene.get("id"),
            "stage": ui_stage,
            "status": completed[-1] if completed else "pending",
            "completed_stages": completed,
        })
    return {"scenes": result}


def _map_to_ui_column(completed_stages: list[str]) -> str:
    """The pipeline has 6 internal stages but the UI shows 4 columns
    (Script, Pre-Prod, Shoot, Post-Prod). This maps the furthest-along
    internal stage to its UI column."""
    if "continuity" in completed_stages or "vfx" in completed_stages or "edit" in completed_stages:
        return "postprod"
    if "shoot" in completed_stages:
        return "shoot"
    if "storyboard" in completed_stages or "casting" in completed_stages:
        return "preprod"
    return "script"


@app.post("/eventarc/scene-updated")
async def scene_updated(request: Request):
    """Eventarc CloudEvents payload. We only care about the document path
    to know which scene changed; the orchestrator re-checks the full DAG
    state from Firestore itself rather than trusting the event payload.
    """
    body = await request.json()
    scene_id = _extract_scene_id(body)
    if not scene_id:
        return {"status": "ignored", "reason": "no scene_id in event"}

    dispatched = await handle_state_change(scene_id)
    return {"status": "ok", "scene_id": scene_id, "dispatched_stages": dispatched}


@app.post("/eventarc/footage-uploaded")
async def footage_uploaded(request: Request):
    """Eventarc CloudEvents payload for a Cloud Storage object.finalized
    event. Expects the object path convention used by storage_client.py:
    'footage/{scene_id}/{filename}'. Marks the scene's 'shoot' stage
    complete and re-runs the DAG, which unlocks Edit and VFX.
    """
    body = await request.json()
    object_name = body.get("name", "")  # e.g. "footage/scene_ab12cd34/take1.mp4"

    parts = object_name.split("/")
    if len(parts) < 2 or parts[0] != "footage":
        return {"status": "ignored", "reason": f"not a footage upload: {object_name}"}

    scene_id = parts[1]
    gs_uri = f"gs://{body.get('bucket', '')}/{object_name}"

    fs.mark_stage_complete(scene_id, "shoot", result=f"footage uploaded: {gs_uri}")
    dispatched = await handle_state_change(scene_id)

    return {"status": "ok", "scene_id": scene_id, "footage": gs_uri, "dispatched_stages": dispatched}


@app.post("/commands")
async def director_command(request: Request):
    """Natural-language command from the Director Console UI, e.g.
    'Generate a darker-toned variant of the dialogue for scene 12.'

    For this scaffold, we treat the raw command as the scene's script text
    and kick off the DAG orchestrator for a fresh scene. A more complete
    implementation would classify intent (new scene vs. revision vs.
    query) before deciding what to dispatch.
    """
    body = await request.json()
    command_text = body.get("command", "")
    scene_id = body.get("scene_id") or f"scene_{uuid.uuid4().hex[:8]}"

    if not command_text:
        return {"status": "error", "reason": "empty command"}

    fs.create_scene(
        scene_id,
        extra={"script_text": command_text, "source": "director_console"},
    )

    dispatched = await handle_state_change(scene_id)

    return {
        "status": "ok",
        "scene_id": scene_id,
        "command": command_text,
        "dispatched_stages": dispatched,
    }


def _extract_scene_id(cloud_event_body: dict) -> str | None:
    # Firestore CloudEvents: document path looks like
    # "projects/{p}/databases/(default)/documents/scenes/{scene_id}"
    document = cloud_event_body.get("document", "")
    if "/scenes/" in document:
        return document.split("/scenes/")[-1]
    return None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
