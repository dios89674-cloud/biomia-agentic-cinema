"""
Firestore is the metadata store (NOT the media store) for Agentic Cinema.

It holds: scene status, agent state, pipeline stage, and references to the
actual files living in Cloud Storage. It never stores footage, audio, or
large binary assets — see services/storage_client.py for that.
"""

import os
from datetime import datetime, timezone
from google.cloud import firestore
from google.cloud.firestore_v1 import ArrayUnion

_db: firestore.Client | None = None


def get_client() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client(project=os.environ["GCP_PROJECT_ID"])
    return _db


def get_scene(scene_id: str) -> dict | None:
    doc = get_client().collection("scenes").document(scene_id).get()
    return doc.to_dict() if doc.exists else None


def create_scene(scene_id: str, extra: dict | None = None) -> None:
    """Creates a new scene document with an empty completed-stages list.
    Safe to call even if the scene already exists (merge=True won't wipe
    completed_stages).
    """
    payload = {
        "completed_stages": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        **(extra or {}),
    }
    get_client().collection("scenes").document(scene_id).set(payload, merge=True)


def mark_stage_complete(scene_id: str, stage: str, result: str) -> None:
    """Appends `stage` to the scene's completed_stages list and records its
    result. Using ArrayUnion (not a plain overwrite) means multiple stages
    that share the same prerequisite — e.g. Storyboard and Casting, which
    both only need 'script' — don't clobber each other's completion record.
    """
    get_client().collection("scenes").document(scene_id).set(
        {
            "completed_stages": ArrayUnion([stage]),
            "results": {stage: result},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def upsert_scene_stage(scene_id: str, stage: str, status: str, extra: dict | None = None) -> None:
    """Legacy helper kept for simple metadata writes that aren't pipeline
    completion events (e.g. recording the raw director command on scene
    creation). Prefer create_scene + mark_stage_complete for pipeline state.
    """
    payload = {
        "stage": stage,
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **(extra or {}),
    }
    get_client().collection("scenes").document(scene_id).set(payload, merge=True)


def list_all_scenes() -> list[dict]:
    docs = get_client().collection("scenes").stream()
    return [doc.to_dict() | {"id": doc.id} for doc in docs]


def list_scenes_by_stage(stage: str) -> list[dict]:
    query = get_client().collection("scenes").where("stage", "==", stage)
    return [doc.to_dict() | {"id": doc.id} for doc in query.stream()]
