import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'

const MODEL_REVEAL_SELECTOR = [
  '.ms-card',
  '.ms-arch-left',
  '.ms-arch-row',
  '.ms-arrow',
  '.ms-metrics-outer > .ms-pill',
  '.ms-metrics-outer > .ms-heading',
  '.ms-metrics-outer > .ms-sub',
  '.ms-metric-card',
  '.ms-confusion-card',
  '.ms-vision > *',
].join(', ')

const MODEL_TYPE_SELECTOR = [
  '.ms-card h3',
  '.ms-card p',
  '.ms-sub',
  '.ms-legend-text',
  '.ms-node-label',
  '.ms-node-meta',
  '.ms-metric-label',
  '.ms-metric-value',
  '.ms-confusion-heading',
  '.ms-cs-label',
  '.ms-cs-val',
  '.ms-vision-sub',
].join(', ')

const typeTimers = new WeakMap<HTMLElement, number>()

function hideForReveal(element: HTMLElement) {
  element.style.opacity = '0'
  element.style.transform = 'translateY(30px) scale(0.98)'
}

function prepareTypeText(element: HTMLElement) {
  if (!element.dataset.fullText) {
    element.dataset.fullText = element.textContent || ''
    element.style.minHeight = `${element.offsetHeight}px`
  }

  window.clearInterval(typeTimers.get(element))
  element.textContent = ''
}

function typeText(element: HTMLElement) {
  const text = element.dataset.fullText || ''
  if (!text) return

  window.clearInterval(typeTimers.get(element))
  element.textContent = ''

  let index = 0
  const timer = window.setInterval(() => {
    element.textContent = text.slice(0, index + 1)
    index += 1

    if (index >= text.length) {
      window.clearInterval(timer)
      typeTimers.delete(element)
    }
  }, Math.max(10, Math.min(26, 760 / text.length)))

  typeTimers.set(element, timer)
}

export default function ModelSection() {
  const sectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const revealItems = Array.from(section.querySelectorAll<HTMLElement>(MODEL_REVEAL_SELECTOR))
    const typeItems = Array.from(section.querySelectorAll<HTMLElement>(MODEL_TYPE_SELECTOR))

    revealItems.forEach(hideForReveal)
    typeItems.forEach(prepareTypeText)

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const target = entry.target as HTMLElement

          if (!entry.isIntersecting) {
            hideForReveal(target)
            target.querySelectorAll<HTMLElement>(MODEL_TYPE_SELECTOR).forEach(prepareTypeText)
            return
          }

          animate(target, {
            opacity: [0, 1],
            y: [30, 0],
            scale: [0.98, 1],
            duration: 760,
            ease: 'outCubic',
          })

          if (target.matches(MODEL_TYPE_SELECTOR)) {
            typeText(target)
          }

          target.querySelectorAll<HTMLElement>(MODEL_TYPE_SELECTOR).forEach(typeText)
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.14 },
    )

    revealItems.forEach(item => observer.observe(item))

    const metricBars = Array.from(section.querySelectorAll<HTMLElement>('.ms-metric-bar'))
    metricBars.forEach(bar => {
      bar.dataset.targetWidth = bar.style.width
      bar.style.width = '0%'
    })

    const metricObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const bar = entry.target as HTMLElement
          const width = bar.dataset.targetWidth || bar.style.width

          if (!entry.isIntersecting) {
            bar.style.width = '0%'
            return
          }

          animate(bar, {
            width: ['0%', width],
            duration: 1000,
            delay: stagger(120),
            ease: 'outQuart',
          })
        })
      },
      { threshold: 0.55 },
    )

    metricBars.forEach(bar => metricObserver.observe(bar))

    return () => {
      typeItems.forEach(item => window.clearInterval(typeTimers.get(item)))
      observer.disconnect()
      metricObserver.disconnect()
    }
  }, [])

  return (
    // PERF: removed backgroundAttachment: 'fixed' — it disables GPU compositing
    // and forces a full repaint on every scroll frame. Use a pseudo-element or
    // a separate fixed-position div if a parallax bg is needed.
    <div ref={sectionRef} id="about" className="model-section">
      <section className="ms-pillars">
        <div className="ms-pillars-grid">
          <div className="ms-card">
            <div className="ms-card-num">1</div>
            <h3>Temporal Feature Extraction</h3>
            <p>
              ResNet50 (frozen, ImageNet pre-trained) distills each frame into a
              rich 2048-dimensional embedding, giving the model strong visual
              priors without retraining from scratch.
            </p>
          </div>

          <div className="ms-card">
            <div className="ms-card-num">2</div>
            <h3>Bidirectional Sequence Modeling</h3>
            <p>
              A BiGRU reads forward and backward across 16 sampled frames,
              capturing long-range temporal context that a single-frame
              classifier would miss entirely.
            </p>
          </div>

          <div className="ms-card">
            <div className="ms-card-num">3</div>
            <h3>Learned Frame Attention</h3>
            <p>
              Temporal Attention assigns a learned weight to every frame, letting
              the model focus on the most discriminative moments rather than
              treating all frames equally.
            </p>
          </div>
        </div>
      </section>

      <div className="ms-section-wrap">
        <div className="ms-divider" />
      </div>

      <section className="ms-arch-outer">
        <div className="ms-arch-inner">
          <div className="ms-arch-layout">
            <div className="ms-arch-left">
              <div className="ms-pill">Model Architecture</div>
              <h2 className="ms-heading">
                End-to-end
                <br />
                pipeline
              </h2>
              <p className="ms-sub">
                Raw video clips flow through a frozen ResNet50 backbone into a
                temporal BiGRU with attention, producing a single suspicion
                probability per clip.
              </p>

              <div className="ms-legend">
                <div className="ms-legend-row">
                  <span className="ms-dot ms-dot-purple" />
                  <span className="ms-legend-text">ResNet50 - 25M params, frozen</span>
                </div>
                <div className="ms-legend-row">
                  <span className="ms-dot ms-dot-blue" />
                  <span className="ms-legend-text">16 frames x 2048-dim vectors</span>
                </div>
                <div className="ms-legend-row">
                  <span className="ms-dot ms-dot-green" />
                  <span className="ms-legend-text">Sigmoid - P(suspicious)</span>
                </div>
              </div>
            </div>

            <div className="ms-arch-flow">
              <div className="ms-arch-row">
                <div className="ms-node ms-node-input">
                  <div className="ms-node-label">Raw Video</div>
                  <div className="ms-node-meta">input - clip sequence</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-purple">
                  <span className="ms-badge ms-badge-purple">feature extractor</span>
                  <div className="ms-node-label">ResNet50 (frozen, ImageNet)</div>
                  <div className="ms-node-meta">25M params - frozen weights</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-blue">
                  <div className="ms-node-label">LayerNorm + Dense(256) + Dropout(0.4)</div>
                  <div className="ms-node-meta">16 frames x 2048-dim - 256-dim</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-blue">
                  <span className="ms-badge ms-badge-blue">temporal modelling</span>
                  <div className="ms-node-label">Bidirectional GRU (64 units)</div>
                  <div className="ms-node-meta">bi-directional - sequence across frames</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-blue">
                  <span className="ms-badge ms-badge-blue">learned frame weighting</span>
                  <div className="ms-node-label">Temporal Attention</div>
                  <div className="ms-node-meta">softmax attention over 16 steps</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-blue">
                  <div className="ms-node-label">Dense(64) + Dropout(0.6)</div>
                  <div className="ms-node-meta">classification head</div>
                </div>
              </div>

              <Arrow />

              <div className="ms-arch-row">
                <div className="ms-node ms-node-output">
                  <span className="ms-badge ms-badge-green">output</span>
                  <div className="ms-node-label">Sigmoid - P(suspicious)</div>
                  <div className="ms-node-meta">scalar - binary classification</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ms-section-wrap">
        <div className="ms-divider" />
      </div>

      <section className="ms-metrics-outer">
        <div className="ms-pill">Evaluation Results</div>
        <h2 className="ms-heading">Performance metrics</h2>
        <p className="ms-sub">
          Evaluated on a held-out test set of 290 clips (150 normal, 140 suspicious).
        </p>

        <div className="ms-metrics-top">
          <MetricCard label="Test Accuracy" value="90.3%" pct={90.3} color="green" />
          <MetricCard label="AUC-ROC" value="0.930" pct={93} color="green" />
          <MetricCard label="Macro F1" value="0.903" pct={90.3} color="blue" />
        </div>

        <div className="ms-metrics-bottom">
          <MetricCard label="Normal Precision" value="89.6%" pct={89.6} color="blue" />
          <MetricCard label="Normal Recall" value="92.0%" pct={92} color="blue" />
          <MetricCard label="Suspicious Precision" value="91.2%" pct={91.2} color="blue" />
          <MetricCard label="Suspicious Recall" value="88.6%" pct={88.6} color="blue" />
        </div>

        <div className="ms-confusion-grid">
          <div className="ms-confusion-card">
            <div className="ms-confusion-heading">NORMAL CLIPS (150 total)</div>
            <ConfusionRow label="Correctly classified" value="138 / 150" variant="ok" />
            <ConfusionRow label="False alarms (FP)" value="12 / 150" variant="warn" />
            <ConfusionRow label="False positive rate" value="8.0%" variant="warn" />
          </div>
          <div className="ms-confusion-card">
            <div className="ms-confusion-heading">SUSPICIOUS CLIPS (140 total)</div>
            <ConfusionRow label="Correctly flagged" value="124 / 140" variant="ok" />
            <ConfusionRow label="Missed detections (FN)" value="16 / 140" variant="warn" />
            <ConfusionRow label="Miss rate" value="11.4%" variant="warn" />
          </div>
        </div>
      </section>

      <section className="ms-vision">
        <div className="ms-pill ms-pill-center">Our Vision</div>
        <p className="ms-vision-text">
          To make video surveillance{' '}
          <strong>intelligent, unobtrusive,</strong> and accessible - detecting
          what matters while ignoring what doesn't.
        </p>
        <p className="ms-vision-sub">
          A model that watches so people don't have to. Accurate, explainable,
          and built to scale.
        </p>
      </section>
    </div>
  )
}

function Arrow() {
  return (
    <div className="ms-arrow">
      <div className="ms-arrow-line" />
      <div className="ms-arrow-tip" />
    </div>
  )
}

function MetricCard({
  label,
  value,
  pct,
  color,
}: {
  label: string
  value: string
  pct: number
  color: 'green' | 'blue'
}) {
  return (
    <div className="ms-metric-card">
      <div className="ms-metric-label">{label}</div>
      <div className={`ms-metric-value ms-metric-${color}`}>{value}</div>
      <div className="ms-metric-bar-wrap">
        <div className="ms-metric-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ConfusionRow({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: 'ok' | 'warn'
}) {
  return (
    <div className="ms-confusion-row">
      <span className="ms-cs-label">{label}</span>
      <span className={`ms-cs-val ms-cs-${variant}`}>{value}</span>
    </div>
  )
}
