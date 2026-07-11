import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <div className="container empty-state">
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Page not found</p>
        <Link to="/" className="btn btn-sm">
          ← Back home
        </Link>
      </div>
    </div>
  )
}
