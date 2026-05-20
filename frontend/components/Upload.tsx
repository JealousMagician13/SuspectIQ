import { useEffect, useRef, useState } from 'react'
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
  stage?: string
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

type AnalysisState = {
  jobId?: string
  status: JobStatus | 'idle'
  progress: number
  stage: string
  result: ResultResponse | null
  error: string
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

function getApiBaseUrl() {
  const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL

  if (!apiBaseUrl) {
    throw new Error('Missing VITE_API_BASE_URL. Create frontend/.env with VITE_API_BASE_URL=http://localhost:3000/api.')
  }

  return apiBaseUrl.replace(/\/$/, '')
}

const API_BASE_URL = getApiBaseUrl()
const POLL_INTERVAL_MS = 1200
const PROGRESS_CRAWL_INTERVAL_MS = 7000
const PROGRESS_CRAWL_STEP = 15
const PROGRESS_CRAWL_MAX = 95

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
    throw new Error(`Could not reach ${url}. If this happens after progress starts, check the backend Render logs for a restart, crash, or CORS error during polling.`)
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
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({})
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isAnalyzing = Object.values(analyses).some(analysis => analysis.status === 'queued' || analysis.status === 'processing')
  const hasResults = Object.values(analyses).some(analysis => analysis.result)
  const analyzedCount = files.filter(file => analyses[file.id]?.result || analyses[file.id]?.error).length
  const batchProgress = files.length > 0
    ? Math.round(files.reduce((total, file) => total + (analyses[file.id]?.progress || 0), 0) / files.length)
    : 0

  useEffect(() => {
    if (!isAnalyzing) return

    const timer = window.setInterval(() => {
      setAnalyses(prev => {
        const next = { ...prev }

        for (const [fileId, analysis] of Object.entries(next)) {
          if (analysis.status !== 'queued' && analysis.status !== 'processing') continue

          next[fileId] = {
            ...analysis,
            progress: Math.min(PROGRESS_CRAWL_MAX, analysis.progress + PROGRESS_CRAWL_STEP),
          }
        }

        return next
      })
    }, PROGRESS_CRAWL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [isAnalyzing])

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
      setAnalyses({})
    }
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(file => file.id !== id))
    setAnalyses(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
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

  function updateAnalysis(fileId: string, updates: Partial<AnalysisState>) {
    const initialAnalysis: AnalysisState = {
      status: 'idle',
      progress: 0,
      stage: '',
      result: null,
      error: '',
    }

    setAnalyses(prev => ({
      ...prev,
      [fileId]: {
        ...initialAnalysis,
        ...prev[fileId],
        ...updates,
      },
    }))
  }

  async function pollResult(fileId: string, jobId: string) {
    while (true) {
      await wait(POLL_INTERVAL_MS)

      const job = await requestJson<StatusResponse>(`${API_BASE_URL}/videos/jobs/${jobId}`)
      updateAnalysis(fileId, {
        status: job.status,
        progress: job.status === 'completed' ? 100 : job.progress,
        stage: job.stage || '',
      })

      if (job.status === 'failed') {
        await requestJson(`${API_BASE_URL}/videos/jobs/${jobId}/result`)
        return
      }

      if (job.status === 'completed') {
        const analysisResult = await requestJson<ResultResponse>(`${API_BASE_URL}/videos/jobs/${jobId}/result`)
        updateAnalysis(fileId, {
          status: 'completed',
          progress: 100,
          stage: 'Analysis complete',
          result: analysisResult,
        })
        return
      }
    }
  }

  async function analyzeVideo(file: UploadedVideo) {
    updateAnalysis(file.id, {
      status: 'queued',
      progress: 0,
      stage: 'Queued',
      result: null,
      error: '',
    })

    try {
      const formData = new FormData()
      formData.append('video', file.file)

      const analysis = await requestJson<AnalyzeResponse>(`${API_BASE_URL}/videos/analyze`, {
        method: 'POST',
        body: formData,
      })

      updateAnalysis(file.id, {
        jobId: analysis.jobId,
        status: analysis.status,
        stage: 'Queued',
      })
      await pollResult(file.id, analysis.jobId)
    } catch (err) {
      updateAnalysis(file.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Video analysis failed.',
      })
    }
  }

  async function analyzeSelectedVideos() {
    if (files.length === 0) return

    setError('')
    setAnalyses({})
    onNext?.(files)
    await Promise.all(files.map(file => analyzeVideo(file)))
  }

  return (
    <section id="upload" className="upload-section">
      <div className="upload-header">
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
          <p className="upload-note">All selected videos will be analyzed and shown with their own result.</p>
        )}

        {files.length > 0 && (
          <div className="upload-file-list" aria-label="Selected videos">
            {files.map(file => {
              const analysis = analyses[file.id]

              return (
              <div key={file.id} className="upload-file-row">
                <VideoIcon name={file.name} />
                <div className="upload-file-details">
                  <span>{file.name}</span>
                  <small>
                    {formatSize(file.size)}
                    {analysis?.status && analysis.status !== 'idle' ? ` · ${analysis.status}` : ''}
                  </small>
                </div>
                <button
                  type="button"
                  className="upload-remove"
                  aria-label={`Remove ${file.name}`}
                  disabled={isAnalyzing}
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
              )
            })}
          </div>
        )}

        {Object.keys(analyses).length > 0 && (
          <div className="upload-status" aria-live="polite">
            <div className="upload-status-row">
              <span>{isAnalyzing ? `Analyzing ${files.length} video${files.length === 1 ? '' : 's'}` : 'Batch analysis complete'}</span>
              <strong>{batchProgress}%</strong>
            </div>
            <div className="upload-progress-track">
              <div className="upload-progress-bar" style={{ width: `${batchProgress}%` }} />
            </div>
            <p className="upload-stage">{analyzedCount} of {files.length} finished</p>
          </div>
        )}

        {Object.keys(analyses).length > 0 && (
          <div className="upload-results">
            {files.map(file => {
              const analysis = analyses[file.id]
              if (!analysis) return null

              return (
                <div key={file.id} className="upload-result-card">
                  <div className="upload-result-title">
                    <span>{file.name}</span>
                    <small>{analysis.stage || analysis.status}</small>
                  </div>

                  {analysis.error ? (
                    <p className="upload-error">{analysis.error}</p>
                  ) : analysis.result ? (
                    <div className="upload-result">
                      <div>
                        <span>Prediction</span>
                        <strong className={`upload-prediction upload-prediction-${analysis.result.prediction}`}>
                          {analysis.result.prediction}
                        </strong>
                      </div>
                      <div>
                        <span>Confidence</span>
                        <strong>{Math.round(analysis.result.confidence * 100)}%</strong>
                      </div>
                      <div>
                        <span>Normal</span>
                        <strong>{Math.round(analysis.result.normalProbability * 100)}%</strong>
                      </div>
                      <div>
                        <span>Suspicious</span>
                        <strong>{Math.round(analysis.result.suspiciousProbability * 100)}%</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-progress-track">
                      <div className="upload-progress-bar" style={{ width: `${analysis.progress}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
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
          onClick={analyzeSelectedVideos}
        >
          {isAnalyzing ? 'Analyzing...' : hasResults ? 'Analyze again' : `Analyze ${files.length > 1 ? 'videos' : 'video'}`}
        </button>
      </div>
    </section>
  )
}
