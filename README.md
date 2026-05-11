# SuspectIQ

SuspectIQ is a video surveillance analysis project that classifies uploaded clips as `normal` or `suspicious`.

The project has two parts:

- `backend/` - Express API for upload, analysis jobs, and results
- `frontend/` - Vite + React UI
- `suspectiq/` - local Python inference package with the bundled `.keras` model

## Features

- Scroll-driven animated landing page
- Model architecture and metrics section
- Video-only upload UI
- Backend video analysis API
- Async job status polling
- Prediction result display
- Team section with animated particles

## Requirements

- Node.js 18+
- npm
- Python 3
- Python package: local `suspectiq/` package or published `suspectiq`

Install the local Python inference package if you are developing from this repo:

```powershell
pip install -e .\suspectiq
```

Or install the published package:

```powershell
pip install suspectiq
```

## Project Structure

```txt
college-project/
├── backend/
│   ├── scripts/
│   ├── src/
│   ├── uploads/
│   ├── .env
│   └── package.json
├── frontend/
│   ├── components/
│   ├── public/
│   ├── src/
│   └── package.json
└── README.md
```

## SuspectIQ Python Package

The `suspectiq/` folder is the local Python package used by the backend inference bridge. It contains:

- `suspectiq/suspectiq/detector.py` - `SuspectIQ` detector implementation
- `suspectiq/suspectiq/layers.py` - TensorFlow custom layers
- `suspectiq/suspectiq/youtube.py` - YouTube helper utilities
- `suspectiq/suspectiq/models/best_model_ucf.keras` - bundled model file
- `suspectiq/tests/` - package tests

When working locally, install it in editable mode from the repo root:

```powershell
pip install -e .\suspectiq
```

After changing files inside `suspectiq/`, restart the backend so the Python bridge uses the latest package code.

## Backend Setup

From the root directory:

```powershell
cd backend
npm install
```

Create `.env` from `.env.example` if needed:

```powershell
copy .env.example .env
```

Install the local inference package if you have not already:

```powershell
pip install -e ..\suspectiq
```

Important default values:

```txt
PORT=3000
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
PYTHON_BIN=python
```

Run the backend:

```powershell
npm run dev
```

Backend runs at:

```txt
http://localhost:3000
```

Health check:

```txt
http://localhost:3000/
http://localhost:3000/api/health
```

## Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
copy .env.example .env
npm run start
```

Frontend runs at:

```txt
http://127.0.0.1:8080
```

The frontend calls the backend URL configured in `frontend/.env`:

```txt
VITE_API_BASE_URL=http://localhost:3000/api
```

For production deployments, set `VITE_API_BASE_URL` to your deployed backend API URL before building:

```txt
VITE_API_BASE_URL=https://YOUR-BACKEND-SERVICE.onrender.com/api
```

## Render Deployment

Deploy the backend and frontend as separate Render services.

Backend service:

```txt
Root Directory: backend
Build Command: npm install && python3 -m pip install -r requirements.txt
Start Command: npm start
```

If you want Render to use the repo-local `suspectiq/` package instead of the published package, install it during the backend build:

```txt
Build Command: npm install && python3 -m pip install -e ../suspectiq
```

Backend environment variables:

```txt
NODE_ENV=production
CORS_ORIGINS=https://YOUR-FRONTEND-SERVICE.onrender.com
PYTHON_BIN=python3
PYTHON_VERSION=3.11.11
```

Frontend service:

```txt
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
```

Frontend environment variables:

```txt
VITE_API_BASE_URL=https://YOUR-BACKEND-SERVICE.onrender.com/api
```

After changing `VITE_API_BASE_URL`, redeploy the frontend because Vite reads this value at build time. After changing `CORS_ORIGINS`, redeploy the backend.

## Video Analysis Flow

1. User uploads a video in the Demo section.
2. Frontend sends `POST /api/videos/analyze`.
3. Backend stores the file and creates an async job.
4. Backend runs Python inference through `scripts/suspectiq_bridge.py`, which imports the `suspectiq` Python package.
5. Frontend polls `GET /api/videos/jobs/:jobId`.
6. When complete, frontend fetches `GET /api/videos/jobs/:jobId/result`.
7. Result is shown in the upload card.

## API Endpoints

### Health

```txt
GET /
GET /api/health
```

Both routes return the backend health payload. Use `/` for a quick browser check and `/api/health` for API-style health checks.

### Analyze Video

```txt
POST /api/videos/analyze
Content-Type: multipart/form-data
Field: video
```

### Job Status

```txt
GET /api/videos/jobs/:jobId
```

### Job Result

```txt
GET /api/videos/jobs/:jobId/result
```

## Supported Video Formats

The frontend and backend support common video formats including:

- MP4
- MOV
- AVI
- MKV
- WEBM
- MPEG / MPG
- WMV

## Common Issues

### `Inference process returned invalid output`

This usually means Python printed extra logs around the JSON result. The backend now extracts the JSON payload robustly, but restart the backend after pulling changes:

```powershell
cd backend
npm run dev
```

### Python command fails on Windows

Use:

```txt
PYTHON_BIN=python
```

not:

```txt
PYTHON_BIN=python3
```

### Backend starts but analysis fails

Check that `suspectiq` imports correctly:

```powershell
python -c "import suspectiq; print('suspectiq ok')"
```

### Frontend says `Missing VITE_API_BASE_URL`

Create `frontend/.env` from the example file:

```powershell
cd frontend
copy .env.example .env
```

Then restart the frontend dev server.

## Build

Build frontend:

```powershell
cd frontend
npm run build
```

Run backend production mode:

```powershell
cd backend
npm start
```

