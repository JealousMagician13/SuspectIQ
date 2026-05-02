import { useCallback, useEffect, useRef, useState } from 'react'
import NavBar from './NavBar'

const FRAME_COUNT = 89
const FRAME_PATH = '/frames/ezgif-frame-'

// ─── Helpers ────────────────────────────────────────────────────────────────

function frameSrc(index: number) {
  return `${FRAME_PATH}${String(index + 1).padStart(3, '0')}.jpg`
}

function loadFrame(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
) {
  const { width, height } = canvas
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = width / height

  const drawWidth = canvasRatio > imageRatio ? width : height * imageRatio
  const drawHeight = canvasRatio > imageRatio ? width / imageRatio : height

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#050505'
  context.fillRect(0, 0, width, height)
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
}

// Returns opacity for a symmetric fade window centered at `center` with half-width `half`.
// Outside the window → 0. At the center → 1.
function fadeWindow(p: number, center: number, half: number) {
  return Math.max(0, 1 - Math.abs(p - center) / half)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Hero() {
  const stageRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const framesRef = useRef<HTMLImageElement[]>([])
  const currentFrameRef = useRef(0)

  // Refs for scroll-driven overlays — updated directly to avoid re-renders on every scroll tick
  const heroRef = useRef<HTMLDivElement | null>(null)
  const storyLeftRef = useRef<HTMLDivElement | null>(null)
  const storyRightRef = useRef<HTMLDivElement | null>(null)
  const endTitleRef = useRef<HTMLDivElement | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  const renderFrame = useCallback((index: number) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const image = framesRef.current[index]
    if (!canvas || !context || !image) return
    currentFrameRef.current = index
    drawCover(context, image, canvas)
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    renderFrame(currentFrameRef.current)
  }, [renderFrame])

  // Preload all frames sequentially, break on first missing frame
  useEffect(() => {
    let cancelled = false

    async function preload() {
      const loadedFrames: HTMLImageElement[] = []

      for (let i = 0; i < FRAME_COUNT; i++) {
        if (cancelled) return
        try {
          loadedFrames[i] = await loadFrame(frameSrc(i))
          setLoadProgress(Math.round(((i + 1) / FRAME_COUNT) * 100))
        } catch {
          break
        }
      }

      if (cancelled || loadedFrames.length === 0) return

      framesRef.current = loadedFrames
      setLoaded(true)
      requestAnimationFrame(() => {
        resizeCanvas()
        renderFrame(0)
      })
    }

    preload()
    return () => { cancelled = true }
  }, [renderFrame, resizeCanvas])

  // Scroll handler — updates frame + overlay opacities directly via DOM refs (no re-render)
  useEffect(() => {
    if (!loaded) return

    function onScroll() {
      const stage = stageRef.current
      if (!stage) return

      const scrollable = stage.offsetHeight - window.innerHeight
      const raw = Math.min(1, Math.max(0, -stage.getBoundingClientRect().top / scrollable))

      // Map raw scroll to an explode-then-return animation curve
      const p = raw < 0.72 ? raw / 0.72 : (1 - raw) / 0.28
      const nextFrame = Math.round(Math.min(1, Math.max(0, p)) * (FRAME_COUNT - 1))

      if (nextFrame !== currentFrameRef.current) {
        requestAnimationFrame(() => renderFrame(nextFrame))
      }

      // Update overlay opacities directly — bypasses React reconciliation
      if (heroRef.current)       heroRef.current.style.opacity       = String(Math.max(0, 1 - raw * 1.65))
      if (storyLeftRef.current)  storyLeftRef.current.style.opacity  = String(fadeWindow(raw, 0.35, 0.13))
      if (storyRightRef.current) storyRightRef.current.style.opacity = String(fadeWindow(raw, 0.61, 0.13))
      if (endTitleRef.current)   endTitleRef.current.style.opacity   = String(raw > 0.78 ? Math.min(1, (raw - 0.78) / 0.12) : 0)
    }

    resizeCanvas()
    onScroll()
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('scroll', onScroll)
    }
  }, [loaded, renderFrame, resizeCanvas])

  return (
    <section ref={stageRef} id="home" className="scroll-stage">
      <div className="sticky-scene">
        <canvas ref={canvasRef} className="product-canvas" aria-hidden="true" />
        <div className="scene-vignette" />

        <NavBar />

        <div ref={heroRef} className="hero-title">
          <h1>SuspectIQ</h1>
          <p>See beyond the footage. Detect what matters.</p>
        </div>

        <div ref={storyLeftRef} className="story-copy story-left" style={{ opacity: 0 }}>
          <span>Deep Learning</span>
          <h2>Frame-by-Frame Analysis.</h2>
        </div>

        <div ref={storyRightRef} className="story-copy story-right" style={{ opacity: 0 }}>
          <span>UCF Crime Dataset</span>
          <h2>13 Crime Categories.</h2>
        </div>

        <div ref={endTitleRef} className="hero-title end-title" style={{ opacity: 0 }}>
          <h2>Detect what matters.</h2>
          <p>Intelligent vision for safer worlds.</p>
        </div>

        {!loaded && (
          <div className="loader">
            <div className="spinner" />
            <p>Loading {loadProgress}%</p>
          </div>
        )}
      </div>
    </section>
  )
}
