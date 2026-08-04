// The brand glyph: a crystal lattice outline, literal to both meanings of
// "Lattice" (lattice-based post-quantum cryptography, and the network of
// verified experts). Renders in whatever `color` it inherits, so it drops
// into any colored badge (navbar, footer) unchanged.
export default function LatticeMark() {
  return (
    <svg viewBox="0 0 22 22" fill="none">
      <path d="M11 1L20 6.5V15.5L11 21L2 15.5V6.5L11 1Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 1V21M2 6.5L20 15.5M20 6.5L2 15.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}
