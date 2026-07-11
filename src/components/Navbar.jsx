import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)

  // Only the landing page has a hero tall/colorful enough for the navbar to
  // float transparently over it; every other page keeps the normal solid,
  // in-flow navbar.
  useEffect(() => {
    if (!isLanding) return
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isLanding])

  function handleLogout() {
    logout()
    navigate('/')
  }

  const transparent = isLanding && !scrolled

  return (
    <header className={`navbar ${isLanding ? 'navbar-overlay' : ''} ${transparent ? 'navbar-transparent' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">L</span>
          Lattice
        </Link>
        <div className="nav-right">
          <nav className="nav-links">
            <NavLink to="/experts">Browse experts</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            {user?.role === 'expert' && <NavLink to="/dashboard">Dashboard</NavLink>}
            {!user && <Link to="/login">Sign in</Link>}
            {user && <span className="tag nav-email">{user.email}</span>}
          </nav>
          <div className="nav-actions">
            {user ? (
              <button className="btn" onClick={handleLogout}>
                Sign out
              </button>
            ) : (
              <Link to="/sign-up" className="btn btn-acc">
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
