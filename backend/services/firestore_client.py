"""
Firestore is the metadata store (NOT the media store) for Agentic Cinema.

It holds: scene status, agent state, pipeline stage, and references to the
actual files living in Cloud Storage. It never stores footage, audio, or
large binary assets — see services/storage_client.py for that.
"""

import os
from datetime import datetime, timezone
from google.cloud import firestore
from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove

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


def try_claim_stage(scene_id: str, stage: str) -> bool:
    """Atomically claims `stage` for processing, using a Firestore
    transaction. Returns True if this call won the claim (should proceed),
    False if another concurrent invocation already claimed or completed it.

    Why this exists: writing a stage's result to Firestore itself fires
    Eventarc again (any write to the document re-triggers the 'document
    written' event). Without this guard, two overlapping invocations can
    both see a stage as 'not done yet' and both run it — wasting Gemini
    quota and writing duplicate rows to ClickHouse. A transaction makes the
    check-and-claim atomic even across multiple Cloud Run instances.
    """
    db = get_client()
    doc_ref = db.collection("scenes").document(scene_id)

    @firestore.transactional
    def _claim(transaction):
        snapshot = doc_ref.get(transaction=transaction)
        data = snapshot.to_dict() or {}
        completed = data.get("completed_stages", [])
        processing = data.get("processing_stages", [])

        if stage in completed or stage in processing:
            return False

        transaction.set(doc_ref, {"processing_stages": ArrayUnion([stage])}, merge=True)
        return True

    return _claim(db.transaction())


def mark_stage_complete(scene_id: str, stage: str, result: str) -> None:
    """Appends `stage` to the scene's completed_stages list, records its
    result, and releases the processing claim from try_claim_stage.
    """
    get_client().collection("scenes").document(scene_id).set(
        {
            "completed_stages": ArrayUnion([stage]),
            "processing_stages": ArrayRemove([stage]),
            "results": {stage: result},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        merge=True,
    )


def release_stage_claim(scene_id: str, stage: str) -> None:
    """If a stage fails after being claimed (e.g. Gemini errors out),
    release the claim so a future retry isn't permanently blocked.
    """
    get_client().collection("scenes").document(scene_id).set(
        {"processing_stages": ArrayRemove([stage])}, merge=True
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


def reset_stage(scene_id: str, stage: str) -> None:
    """Removes `stage` from completed_stages so the orchestrator will
    re-run it. Useful for demos/debugging — re-running Continuity after
    new facts land in ClickHouse, for example.
    """
    get_client().collection("scenes").document(scene_id).set(
        {"completed_stages": ArrayRemove([stage])}, merge=True
    )


def delete_scene(scene_id: str) -> None:
    get_client().collection("scenes").document(scene_id).delete()


def list_scenes_by_stage(stage: str) -> list[dict]:
    query = get_client().collection("scenes").where("stage", "==", stage)
    return [doc.to_dict() | {"id": doc.id} for doc in query.stream()]
