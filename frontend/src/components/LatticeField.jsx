import { useEffect, useRef } from 'react'

// A generative lattice of connected nodes -- literal to both meanings of
// "Lattice": the crystal structure lattice-based post-quantum cryptography
// is built on, and the network of verified experts the product connects.
// Colors are read from --lp-canvas-* CSS vars so it follows the app's
// light/dark theme without duplicating the palette in JS.
export default function LatticeField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const REVEAL_MS = 1400

    let nodes = []
    let edges = []
    let w = 0
    let h = 0
    let startTime = null
    let rafId = null

    function readColor(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    }

    function buildLattice() {
      nodes = []
      edges = []
      const cols = 8
      const rows = 6
      const spacingX = w / (cols - 1)
      const spacingY = h / (rows - 1)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offsetX = r % 2 === 1 ? spacingX * 0.5 : 0
          const jx = Math.sin(r * 12.9 + c * 7.3) * 0.5 * spacingX * 0.28
          const jy = Math.cos(c * 5.1 + r * 3.7) * 0.5 * spacingY * 0.22
          const x = c * spacingX + offsetX + jx - spacingX * 0.25
          const y = r * spacingY + jy
          if (x < -20 || x > w + 20) continue
          nodes.push({
            x, y, baseX: x, baseY: y,
            phase: (r * cols + c) * 0.7,
            verified: Math.random() < 0.14,
            r: 2 + Math.random() * 1.6,
          })
        }
      }
      const maxDist = Math.max(spacingX, spacingY) * 1.35
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < maxDist) edges.push({ a: nodes[i], b: nodes[j], seed: Math.random() })
        }
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildLattice()
    }

    function draw(t) {
      if (startTime === null) startTime = t
      const elapsed = t - startTime
      const revealP = reduced ? 1 : Math.min(1, elapsed / REVEAL_MS)

      ctx.clearRect(0, 0, w, h)

      const nodeColor = readColor('--lp-canvas-node')
      const edgeColor = readColor('--lp-canvas-edge')
      const signalColor = readColor('--lp-canvas-signal')

      for (const e of edges) {
        const localReveal = Math.max(0, Math.min(1, revealP * 1.6 - e.seed * 0.6))
        if (localReveal <= 0) continue
        const isSignalEdge = e.a.verified || e.b.verified
        const alpha = (isSignalEdge ? 0.35 : 0.1) * localReveal
        ctx.strokeStyle = `rgba(${isSignalEdge ? signalColor : edgeColor},${alpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(e.a.x, e.a.y)
        ctx.lineTo(e.b.x, e.b.y)
        ctx.stroke()
      }

      const driftT = reduced ? 0 : t * 0.00035
      for (const n of nodes) {
        if (!reduced) {
          n.x = n.baseX + Math.sin(driftT + n.phase) * 3.2
          n.y = n.baseY + Math.cos(driftT * 0.8 + n.phase) * 3.2
        }
        const localReveal = Math.max(0, Math.min(1, revealP * 1.8 - (n.phase % 3) * 0.15))
        if (localReveal <= 0) continue
        const pulse = n.verified && !reduced ? Math.sin(t * 0.0022 + n.phase) * 0.5 + 0.5 : 0.5
        if (n.verified) {
          ctx.fillStyle = `rgba(${signalColor},${(0.55 + pulse * 0.35) * localReveal})`
          ctx.beginPath()
          ctx.arc(n.x, n.y, (n.r + 1.4) * localReveal, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(${signalColor},${0.12 * localReveal})`
          ctx.beginPath()
          ctx.arc(n.x, n.y, (n.r + 6) * localReveal, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = `rgba(${nodeColor},${0.5 * localReveal})`
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r * localReveal, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (revealP < 1 || !reduced) rafId = requestAnimationFrame(draw)
    }

    function restart() {
      startTime = null
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(draw)
    }

    resize()
    rafId = requestAnimationFrame(draw)

    window.addEventListener('resize', resize)
    // Re-draw with the new palette immediately on a theme change, instead
    // of waiting for the next resize/interaction.
    const themeObserver = new MutationObserver(restart)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const schemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    schemeQuery.addEventListener('change', restart)

    return () => {
      window.removeEventListener('resize', resize)
      themeObserver.disconnect()
      schemeQuery.removeEventListener('change', restart)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return <canvas ref={canvasRef} className="lp-lattice-canvas" aria-hidden="true" />
}
