# Agentic Cinema — clean setup

## Requirements

- Python 3.12
- Node.js 18+
- Google Cloud CLI
- A Google Cloud project with billing enabled for the services you use
- A ClickHouse Cloud or self-hosted HTTPS endpoint

## 1. Backend (Windows PowerShell)

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` with your real Google Cloud and ClickHouse values. Never commit `.env`.

Authenticate Google Cloud:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Run the API:

```powershell
uvicorn main:app --reload --port 8080
```

Check:

`http://127.0.0.1:8080/health`

## 2. Frontend

Open a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
```

Set `VITE_API_BASE=http://127.0.0.1:8080` in `frontend/.env`, then:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal.

## 3. ClickHouse MCP

The backend now installs the official `mcp-clickhouse` package and launches it through MCP stdio. Docker-in-Docker is intentionally not used, which avoids a Cloud Run runtime problem. The official server exposes `run_query`, `list_databases`, and `list_tables`.

Create the schema from `clickhouse/schema.sql` in your ClickHouse instance.

## 4. Cloud Run

From `backend/`:

```bash
gcloud run deploy agentic-cinema-backend --source . --region us-central1
```

Then set the frontend API URL to the deployed backend URL and deploy the frontend.

## Important

Use Python 3.12 for this project. Do not reuse a Python 3.13 virtual environment created during a previous failed installation. Delete `.venv` and recreate it if necessary.
