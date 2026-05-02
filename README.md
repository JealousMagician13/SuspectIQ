# SuspectIQ

SuspectIQ is a video surveillance analysis project that classifies uploaded clips as `normal` or `suspicious`.

The project has two parts:

- `frontend/` - Vite + React UI
- `backend/` - Express API for upload, analysis jobs, and results

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
- Python package: `suspectiq`

Install the Python inference package if needed:

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
├── BACKEND_API_CONTRACT.md
└── README.md
```

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

Important default values:

```txt
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PYTHON_BIN=python
```

Run the backend:

```powershell
npm run dev
```

Backend runs at:

```txt
http://localhost:8000
```

Health check:

```txt
http://localhost:8000/api/health
```

## Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at:

```txt
http://127.0.0.1:5173
```

The frontend calls the backend at:

```txt
http://localhost:8000/api
```

To override this, create `frontend/.env`:

```txt
VITE_API_BASE_URL=http://localhost:8000/api
```

## Video Analysis Flow

1. User uploads a video in the Demo section.
2. Frontend sends `POST /api/videos/analyze`.
3. Backend stores the file and creates an async job.
4. Backend runs Python inference through `scripts/suspectiq_bridge.py`.
5. Frontend polls `GET /api/videos/jobs/:jobId`.
6. When complete, frontend fetches `GET /api/videos/jobs/:jobId/result`.
7. Result is shown in the upload card.

## API Endpoints

### Health

```txt
GET /api/health
```

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

