# SuspectIQ Backend API

Express-based REST API for video analysis. Accepts video uploads, queues async analysis jobs, and exposes status/result endpoints.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Upload handling | Multer |
| Security | Helmet, CORS, express-rate-limit |
| Logging | morgan + structured JSON logger |
| IDs | uuid |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env as needed
```

### 3. Run in development

```bash
npm run dev
```

### 4. Run in production

```bash
NODE_ENV=production npm start
```

The server starts on `http://localhost:8000` by default.

---

## API Reference

### Health check

```
GET /api/health
```

### Upload video for analysis

```
POST /api/videos/analyze
Content-Type: multipart/form-data

Field: video (File, required)
```

Returns `202 Accepted` with a `jobId`.

### Check job status

```
GET /api/videos/jobs/:jobId
```

Returns `status` (`queued` | `processing` | `completed` | `failed`) and `progress` (0–100).

### Get result

```
GET /api/videos/jobs/:jobId/result
```

Returns the full prediction result once `status === 'completed'`.  
Returns `409 RESULT_NOT_READY` while still processing.

---

## Project structure

```
src/
├── config/          # Env-driven config
├── controllers/     # Route handlers
├── middleware/      # Upload, error handler, 404
├── routes/          # Express routers
├── services/        # Job store + analysis worker
├── utils/           # Logger, ApiError
├── app.js           # Express app (middleware + routes)
└── server.js        # Entry point + graceful shutdown
```

---

## ML inference — SuspectIQ bridge

The analysis worker spawns `scripts/suspectiq_bridge.py` as a child process, passing the uploaded file path as an argument. The script calls `SuspectIQ().predict(path)`, serialises the result to JSON on stdout, and exits.

**Requirements:**

```bash
pip install suspectiq
```

**How it works:**

```
Node worker
  └─ spawn python3 scripts/suspectiq_bridge.py <file_path>
       └─ SuspectIQ().predict(file_path)
            └─ stdout: { prediction, confidence, normalProbability, suspiciousProbability, model }
```

If the library exposes `normal_probability` / `suspicious_probability` directly on the result object, update the bridge to read them instead of deriving from confidence:

```python
# In suspectiq_bridge.py, replace the probability block with:
normal_prob = float(result.normal_probability)
suspicious_prob = float(result.suspicious_probability)
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | HTTP port |
| `NODE_ENV` | `development` | Environment |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `MAX_FILE_SIZE_MB` | `500` | Max upload size in MB |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `PYTHON_BIN` | `python3` | Python executable (use full path in venvs) |
| `INFERENCE_TIMEOUT_MS` | `300000` | Max time to wait for Python process (5 min) |
