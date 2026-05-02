import { useEffect, useRef } from 'react'
import { animate, stagger } from 'animejs'

declare global {
  interface Window {
    particlesJS?: (tagId: string, params: unknown) => void
    pJSDom?: Array<{ pJS?: { fn?: { vendors?: { destroypJS?: () => void } } } }>
  }
}

const teamMembers = [
  {
    name: 'Aditya Adukuri',
    image: '/team/adityaadukuri.png',
  },
  {
    name: 'Charan Kandibilla',
    image: '/team/charankandibilla.png',
  },
  {
    name: 'Shirish Bhan',
    image: '/team/shirishbhan.png',
  },
]

const PARTICLE_TARGET = 'team-particles'
const PARTICLES_SCRIPT_ID = 'particles-js-script'
const PARTICLE_CONFIG = {
  particles: {
    number: {
      value: 120,
      density: {
        enable: true,
        value_area: 780,
      },
    },
    color: {
      value: '#ffffff',
    },
    shape: {
      type: 'circle',
      stroke: {
        width: 0,
        color: '#ffffff',
      },
    },
    opacity: {
      value: 1,
      random: true,
      anim: {
        enable: true,
        speed: 2.8,
        opacity_min: 0.72,
        sync: false,
      },
    },
    size: {
      value: 3.3,
      random: true,
    },
    line_linked: {
      enable: true,
      distance: 150,
      color: '#ffffff',
      opacity: 0.78,
      width: 1,
    },
    move: {
      enable: true,
      speed: 7,
      direction: 'none',
      random: true,
      straight: false,
      out_mode: 'out',
    },
  },
  interactivity: {
    detect_on: 'canvas',
    events: {
      onhover: {
        enable: true,
        mode: 'grab',
      },
      onclick: {
        enable: true,
        mode: 'push',
      },
      resize: true,
    },
    modes: {
      grab: {
        distance: 150,
        line_linked: {
          opacity: 1,
        },
      },
      push: {
        particles_nb: 3,
      },
    },
  },
  retina_detect: true,
}

export default function Team() {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function startParticles() {
      window.particlesJS?.(PARTICLE_TARGET, PARTICLE_CONFIG)
    }

    if (window.particlesJS) {
      startParticles()
    } else {
      const existingScript = document.getElementById(PARTICLES_SCRIPT_ID) as HTMLScriptElement | null

      if (existingScript) {
        existingScript.addEventListener('load', startParticles, { once: true })
      } else {
        const script = document.createElement('script')
        script.id = PARTICLES_SCRIPT_ID
        script.src = '/particles/particles.min.js'
        script.async = true
        script.addEventListener('load', startParticles, { once: true })
        document.body.appendChild(script)
      }
    }

    return () => {
      window.pJSDom?.forEach(instance => instance.pJS?.fn?.vendors?.destroypJS?.())
      const target = document.getElementById(PARTICLE_TARGET)
      if (target) target.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const headerItems = Array.from(section.querySelectorAll<HTMLElement>('.team-header > *'))
    const cards = Array.from(section.querySelectorAll<HTMLElement>('.team-card'))
    const portraits = Array.from(section.querySelectorAll<HTMLElement>('.team-card img'))

    ;[...headerItems, ...cards].forEach(item => {
      item.style.opacity = '0'
      item.style.transform = 'translateY(34px) scale(0.96)'
    })

    portraits.forEach(portrait => {
      portrait.style.transform = 'scale(0.88)'
    })

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          observer.disconnect()

          animate(headerItems, {
            opacity: [0, 1],
            y: [28, 0],
            scale: [0.98, 1],
            duration: 760,
            delay: stagger(90),
            ease: 'outCubic',
          })

          animate(cards, {
            opacity: [0, 1],
            y: [42, 0],
            scale: [0.94, 1],
            duration: 820,
            delay: stagger(140),
            ease: 'outBack',
          })

          animate(portraits, {
            scale: [0.88, 1],
            rotate: [-3, 0],
            duration: 900,
            delay: stagger(140),
            ease: 'outElastic(1, .7)',
          })
        })
      },
      { threshold: 0.28 },
    )

    observer.observe(section)

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="team" className="team-section">
      <div id={PARTICLE_TARGET} className="team-particles" aria-hidden="true" />
      <div className="team-inner">
        <div className="team-header">
          <span>CTRL ALT DEFEAT</span>
          <h2>Our Team</h2>
          <p>4th Year BTech CSE students building intelligent video surveillance for real-world safety.</p>
        </div>

        <div className="team-grid">
          {teamMembers.map(member => (
            <article className="team-card" key={member.name}>
              <img src={member.image} alt={member.name} />
              <div>
                <h3>{member.name}</h3>
                <p>4th Year BTech CSE Student</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
