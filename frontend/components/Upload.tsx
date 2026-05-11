import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'

type UploadedVideo = {
  id: string
  file: File
  name: string
  size: number
}

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

type AnalyzeResponse = {
  jobId: string
  status: JobStatus
  message: string
}

type StatusResponse = {
  jobId: string
  status: JobStatus
  progress: number
}

type ResultResponse = {
  jobId: string
  videoId: string
  filename: string
  prediction: 'normal' | 'suspicious'
  confidence: number
  normalProbability: number
  suspiciousProbability: number
  processedFrames?: number
  model: string
  completedAt: string
}

type ApiErrorResponse = {
  error?: {
    code?: string
    message?: string
  }
}

type UploadProps = {
  onBack?: () => void
  onNext?: (files: UploadedVideo[]) => void
}

function getDefaultApiBaseUrl() {
  return import.meta.env.DEV ? 'http://localhost:8000/api' : 'https://suspectiq-backend.onrender.com/api'
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, '')
const POLL_INTERVAL_MS = 1200

const VIDEO_EXTENSIONS = new Set([
  '3g2',
  '3gp',
  'avi',
  'm4v',
  'mkv',
  'mov',
  'mp4',
  'mpeg',
  'mpg',
  'webm',
  'wmv',
])

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function isVideoFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return file.type.startsWith('video/') || Boolean(extension && VIDEO_EXTENSIONS.has(extension))
}

function VideoIcon({ name }: { name: string }) {
  const extension = name.split('.').pop()?.toUpperCase() || 'VIDEO'
  const label = extension.length <= 4 ? extension : 'VIDEO'

  return <div className="upload-file-icon">{label}</div>
}

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function readApiError(response: Response) {
  const fallback = `Request failed with status ${response.status}`

  try {
    const body = await response.json() as ApiErrorResponse
    return body.error?.message || fallback
  } catch {
    return fallback
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch {
    throw new Error(`Could not reach the SuspectIQ API at ${API_BASE_URL}. Check the deployed VITE_API_BASE_URL and backend CORS_ORIGINS values.`)
  }

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  return response.json() as Promise<T>
}

export default function Upload({ onBack, onNext }: UploadProps) {
  const [files, setFiles] = useState<UploadedVideo[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<JobStatus | 'idle'>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ResultResponse | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function addFiles(incoming: FileList | File[] | null) {
    if (!incoming) return

    const incomingFiles = Array.from(incoming)
    const validVideos = incomingFiles.filter(isVideoFile)

    setError(validVideos.length !== incomingFiles.length ? 'Only video files can be uploaded.' : '')

    const newFiles = validVideos.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
    }))

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
      setStatus('idle')
      setProgress(0)
      setResult(null)
    }
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(file => file.id !== id))
    setStatus('idle')
    setProgress(0)
    setResult(null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  function handleBrowse(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(true)
  }

  function handleOpenPicker() {
    inputRef.current?.click()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenPicker()
    }
  }

  async function pollResult(jobId: string) {
    while (true) {
      await wait(POLL_INTERVAL_MS)

      const job = await requestJson<StatusResponse>(`${API_BASE_URL}/videos/jobs/${jobId}`)
      setStatus(job.status)
      setProgress(job.progress)

      if (job.status === 'failed') {
        await requestJson(`${API_BASE_URL}/videos/jobs/${jobId}/result`)
        return
      }

      if (job.status === 'completed') {
        const analysisResult = await requestJson<ResultResponse>(`${API_BASE_URL}/videos/jobs/${jobId}/result`)
        setResult(analysisResult)
        return
      }
    }
  }

  async function analyzeSelectedVideo() {
    const selected = files[0]
    if (!selected) return

    setError('')
    setResult(null)
    setProgress(0)
    setStatus('queued')

    try {
      const formData = new FormData()
      formData.append('video', selected.file)

      const analysis = await requestJson<AnalyzeResponse>(`${API_BASE_URL}/videos/analyze`, {
        method: 'POST',
        body: formData,
      })

      onNext?.(files)
      setStatus(analysis.status)
      await pollResult(analysis.jobId)
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : 'Video analysis failed.')
    }
  }

  const isAnalyzing = status === 'queued' || status === 'processing'

  return (
    <section id="upload" className="upload-section">
      <div className="upload-header">
        <span className="ms-pill">Product Demo</span>
        <h2>Upload surveillance video</h2>
        <p>Add a clip for analysis. The uploader accepts video files only.</p>
      </div>

      <div className="upload-card">
        <div
          className={`upload-dropzone${dragging ? ' upload-dropzone-active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={handleOpenPicker}
          onKeyDown={handleKeyDown}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragging(false)}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="video/*,.3g2,.3gp,.avi,.m4v,.mkv,.mov,.mp4,.mpeg,.mpg,.webm,.wmv"
            className="upload-input"
            onChange={handleBrowse}
          />

          <div className="upload-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 8-6 4 6 4V8Z" />
              <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
            </svg>
          </div>

          <p className="upload-drop-title">
            Drop videos here or <span>browse</span>
          </p>
          <p className="upload-drop-meta">MP4, MOV, AVI, MKV, WEBM and other video formats</p>
        </div>

        {error && <p className="upload-error">{error}</p>}

        {files.length > 1 && (
          <p className="upload-note">Analyzing the first selected video. Remove it to analyze another file.</p>
        )}

        {files.length > 0 && (
          <div className="upload-file-list" aria-label="Selected videos">
            {files.map(file => (
              <div key={file.id} className="upload-file-row">
                <VideoIcon name={file.name} />
                <div className="upload-file-details">
                  <span>{file.name}</span>
                  <small>{formatSize(file.size)}</small>
                </div>
                <button
                  type="button"
                  className="upload-remove"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(file.id)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {status !== 'idle' && (
          <div className="upload-status" aria-live="polite">
            <div className="upload-status-row">
              <span>{status === 'completed' ? 'Analysis complete' : status === 'failed' ? 'Analysis failed' : 'Analyzing video'}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="upload-progress-track">
              <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className="upload-result">
            <div>
              <span>Prediction</span>
              <strong className={`upload-prediction upload-prediction-${result.prediction}`}>
                {result.prediction}
              </strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{Math.round(result.confidence * 100)}%</strong>
            </div>
            <div>
              <span>Normal</span>
              <strong>{Math.round(result.normalProbability * 100)}%</strong>
            </div>
            <div>
              <span>Suspicious</span>
              <strong>{Math.round(result.suspiciousProbability * 100)}%</strong>
            </div>
          </div>
        )}
      </div>

      <div className="upload-actions">
        <button type="button" className="upload-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="upload-primary"
          disabled={files.length === 0 || isAnalyzing}
          onClick={analyzeSelectedVideo}
        >
          {isAnalyzing ? 'Analyzing...' : result ? 'Analyze again' : 'Analyze video'}
        </button>
      </div>
    </section>
  )
}
