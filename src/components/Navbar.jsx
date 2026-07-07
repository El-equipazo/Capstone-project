import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">L</span>
          Lattice
        </Link>
        <nav className="nav-links">
          <NavLink to="/experts">Browse experts</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          {user ? (
            <>
              <span className="tag">{user.email}</span>
              <button className="btn btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/sign-up" className="btn btn-acc btn-sm">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
