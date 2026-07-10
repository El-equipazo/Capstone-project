import { useId } from 'react'

// Decorative illustration: faceted "crystal" nodes drifting in a loose
// diagonal chain (the lattice-crystal analog of birds in flight), dissolving
// into a low-poly mesh at the horizon (the analog of clouds). Ties back to
// the brand name and to real lattice-based PQC algorithms (CRYSTALS-Kyber/
// Dilithium) rather than being arbitrary decoration.
//
// Reused at two scales: full hero (tall, xMidYMid) and small card banners
// (short/wide, xMidYMin — keeps the crystal flock, which sits high in the
// viewBox, in frame instead of the empty mesh band below it).

const CRYSTALS = [
  { x: 70, y: 130, size: 22, opacity: 0.6, drift: 'driftA' },
  { x: 230, y: 95, size: 16, opacity: 0.55, drift: 'driftB' },
  { x: 400, y: 115, size: 20, opacity: 0.65, drift: 'driftC' },
  { x: 580, y: 82, size: 15, opacity: 0.5, drift: 'driftA' },
  { x: 760, y: 105, size: 24, opacity: 0.7, drift: 'driftB' },
  { x: 930, y: 70, size: 17, opacity: 0.55, drift: 'driftC' },
  { x: 1100, y: 120, size: 26, opacity: 0.75, drift: 'driftA' },
]

function Crystal({ x, y, size, opacity, drift, faceId, glowId }) {
  const h = size
  const w = size * 0.72
  const glowR = size * 2.6
  return (
    // Positioning translate lives on this outer <g> (SVG attribute) — the
    // float animation's CSS `transform` goes on the inner <g> instead, since
    // a CSS transform on the same element replaces rather than composes with
    // the transform="translate(...)" attribute, which was collapsing every
    // crystal back toward the origin.
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <g className={`lattice-crystal ${drift}`}>
        <circle r={glowR} fill={`url(#${glowId})`} />
        <polygon
          points={`0,${-h} ${w},0 0,${h} ${-w},0`}
          fill={`url(#${faceId})`}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1.1"
        />
        <polygon points={`0,${-h} ${w},0 0,${h * 0.15}`} fill="rgba(255,255,255,0.55)" />
      </g>
    </g>
  )
}

export default function LatticeHeroArt({ preserveAspectRatio = 'xMidYMid slice' }) {
  const uid = useId()
  const faceId = `${uid}-crystalFace`
  const glowId = `${uid}-crystalGlow`
  const fadeId = `${uid}-meshFade`
  const maskId = `${uid}-meshMask`

  return (
    <svg className="hero-art" viewBox="0 0 1200 600" preserveAspectRatio={preserveAspectRatio} aria-hidden="true">
      <defs>
        <linearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c3d3ff" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="72%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.95" />
        </linearGradient>
        <mask id={maskId}>
          <rect x="0" y="0" width="1200" height="600" fill={`url(#${fadeId})`} />
        </mask>
      </defs>

      {/* connecting "bonds" between crystal nodes, echoing a lattice diagram */}
      <g stroke="rgba(255,255,255,0.32)" strokeWidth="1">
        {CRYSTALS.slice(0, -1).map((c, i) => {
          const next = CRYSTALS[i + 1]
          return <line key={c.x} x1={c.x} y1={c.y} x2={next.x} y2={next.y} />
        })}
      </g>

      {CRYSTALS.map((c) => (
        <Crystal key={c.x} {...c} faceId={faceId} glowId={glowId} />
      ))}

      {/* low-poly mesh dissolving at the horizon, analog of the cloud band */}
      <g mask={`url(#${maskId})`} stroke="rgba(255,244,224,0.6)" strokeWidth="1" fill="none">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 13 }).map((_, col) => {
            const y = 460 + row * 26
            const x = col * 100 - (row % 2 === 0 ? 0 : 50)
            return <polyline key={`${row}-${col}`} points={`${x},${y} ${x + 50},${y + 18} ${x + 100},${y}`} />
          })
        )}
      </g>
      <g mask={`url(#${maskId})`} fill="rgba(255,244,224,0.8)">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 13 }).map((_, col) => {
            const y = 460 + row * 26
            const x = col * 100 - (row % 2 === 0 ? 0 : 50)
            return <circle key={`${row}-${col}`} cx={x} cy={y} r="2" />
          })
        )}
      </g>
    </svg>
  )
}
