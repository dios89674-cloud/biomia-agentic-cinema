# Eventarc Setup

The backend wakes up only when Firestore state changes — no polling, no
idle server. Run this once after deploying the backend to Cloud Run:

```bash
gcloud eventarc triggers create agentic-cinema-firestore-trigger \
  --location=$GCP_REGION \
  --destination-run-service=agentic-cinema-backend \
  --destination-run-region=$GCP_REGION \
  --destination-run-path=/eventarc/scene-updated \
  --event-filters="type=google.cloud.firestore.document.v1.written" \
  --event-filters="database=(default)" \
  --service-account=$EVENTARC_SERVICE_ACCOUNT
```

Note: Firestore Eventarc triggers always deliver the body as protobuf, not
JSON — do NOT pass `--event-data-content-type=application/json` (Google
rejects it for this event type). The backend doesn't parse the body at all;
it reads the changed document's ID from the `ce-subject` CloudEvents header
instead, which is always plain text regardless of content type.

## Required IAM roles for the Eventarc service account

- `roles/eventarc.eventReceiver`
- `roles/run.invoker` (on the `agentic-cinema-backend` Cloud Run service)

## Enabling the required APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  eventarc.googleapis.com \
  storage.googleapis.com
```
