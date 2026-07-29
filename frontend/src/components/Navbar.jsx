import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

function initials(str) {
  const words = (str || '').replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

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
            {user?.role === 'organization' && <NavLink to="/organization">Dashboard</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            {!user && <Link to="/login">Sign in</Link>}
          </nav>
          <div className="nav-actions">
            <NotificationBell />
            {user ? (
              <div className="account-wrap">
                <button className="account-trigger" onClick={() => setAccountOpen((v) => !v)} aria-label="Account menu">
                  <span className="avatar avatar-sm">{initials(user.email)}</span>
                  <span className="chev">▾</span>
                </button>
                {accountOpen && (
                  <div className="account-dropdown card">
                    <div className="account-head">
                      <span className="avatar avatar-sm">{initials(user.email)}</span>
                      <div className="id-text">
                        <span className="email">{user.email}</span>
                        <span className={`badge role-${user.role}`}>{user.role}</span>
                      </div>
                    </div>
                    <button className="account-row" onClick={handleLogout}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
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
