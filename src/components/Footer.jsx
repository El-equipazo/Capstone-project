export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Lattice · QuantumConnect</span>
        <span>Post-quantum readiness for finance, healthcare, government &amp; critical infrastructure</span>
      </div>
    </footer>
  )
}
