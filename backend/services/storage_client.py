"""
Cloud Storage holds the real payload: scripts, raw footage, storyboards,
rendered assets. Firestore only ever stores a reference (gs:// path) to
what lives here — never the binary itself.
"""

import os
from google.cloud import storage

_client: storage.Client | None = None


def get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client(project=os.environ["GCP_PROJECT_ID"])
    return _client


def upload_asset(local_path: str, scene_id: str, kind: str) -> str:
    """Uploads a file and returns its gs:// URI.
    `kind` is one of: script, footage, storyboard, render.
    Uploading here is what fires the Eventarc trigger downstream.
    """
    bucket = get_client().bucket(os.environ["GCS_BUCKET"])
    blob_path = f"{kind}/{scene_id}/{os.path.basename(local_path)}"
    blob = bucket.blob(blob_path)
    blob.upload_from_filename(local_path)
    return f"gs://{os.environ['GCS_BUCKET']}/{blob_path}"


def signed_url(gs_uri: str, expiration_minutes: int = 60) -> str:
    """Generates a short-lived signed URL so the frontend can preview
    an asset without making the bucket public."""
    bucket_name, blob_path = gs_uri.replace("gs://", "").split("/", 1)
    blob = get_client().bucket(bucket_name).blob(blob_path)
    return blob.generate_signed_url(expiration=expiration_minutes * 60)
