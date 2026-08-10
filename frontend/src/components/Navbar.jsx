import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { LANGUAGE_OPTIONS } from '../i18n/translations'
import NotificationBell from './NotificationBell'
import LanguagePopup from './LanguagePopup'
import LatticeMark from './LatticeMark'

function initials(str) {
  const words = (str || '').replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Only experts have a profile photo today (expert_profiles.profile_photo_url,
// surfaced onto the session user by authApi.me()) -- organizations/admins
// fall back to initials same as an expert who hasn't uploaded one yet.
function AccountAvatar({ user }) {
  return (
    <span className="avatar avatar-sm" style={user.profile_photo_url ? { overflow: 'hidden' } : undefined}>
      {user.profile_photo_url ? (
        <img src={user.profile_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials(user.email)
      )}
    </span>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7 10-7" />
    </svg>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { language, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [showLanguagePopup, setShowLanguagePopup] = useState(false)
  const accountRef = useRef(null)
  const currentLanguageName = LANGUAGE_OPTIONS.find((o) => o.code === language)?.name ?? language

  useEffect(() => {
    if (!accountOpen) return
    function onClickOutside(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [accountOpen])

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
    <header className={`navbar ${isLanding ? 'navbar-overlay' : ''} ${transparent ? 'navbar-transparent' : ''} ${isLanding && scrolled ? 'navbar-landing-solid' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><LatticeMark /></span>
          Lattice
        </Link>
        <div className="nav-right">
          <nav className="nav-links">
            {/* Plain <a> tags, not <NavLink> -- these do a full page reload on
                click rather than a client-side route change (requested
                behavior). The active-link underline is recreated manually
                since NavLink normally handles that automatically. */}
            <a href="/experts" className={location.pathname === '/experts' ? 'active' : ''}>{t('nav.browseExperts')}</a>
            <a href="/how-it-works" className={location.pathname === '/how-it-works' ? 'active' : ''}>{t('nav.howItWorks')}</a>
            {user?.role === 'expert' && (
              <a href="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>{t('nav.dashboard')}</a>
            )}
            {user?.role === 'organization' && (
              <a href="/organization" className={location.pathname === '/organization' ? 'active' : ''}>{t('nav.dashboard')}</a>
            )}
            {user?.role === 'admin' && (
              <a href="/admin" className={location.pathname === '/admin' ? 'active' : ''}>{t('nav.admin')}</a>
            )}
            {!user && <Link to="/login">{t('nav.signIn')}</Link>}
          </nav>
          <div className="nav-actions">
            <NotificationBell />
            {user ? (
              <div className="account-wrap" ref={accountRef}>
                <button className="account-trigger" onClick={() => setAccountOpen((v) => !v)} aria-label="Account menu">
                  <AccountAvatar user={user} />
                  <span className="chev">▾</span>
                </button>
                {accountOpen && (
                  <div className="account-dropdown card">
                    <div className="account-head">
                      <AccountAvatar user={user} />
                      <div className="id-text">
                        <span className="email">{user.email}</span>
                        <span className={`badge role-${user.role}`}>{user.role}</span>
                      </div>
                    </div>
                    <button type="button" className="account-row" onClick={toggleTheme}>
                      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                      <span className="account-row-label">{t('nav.darkMode')}</span>
                      <span className="account-row-value">{theme === 'dark' ? t('nav.on') : t('nav.off')}</span>
                    </button>
                    <button type="button" className="account-row" onClick={() => { setShowLanguagePopup(true); setAccountOpen(false) }}>
                      <GlobeIcon />
                      <span className="account-row-label">{t('nav.language')}</span>
                      <span className="account-row-value">{currentLanguageName}</span>
                    </button>
                    {typeof user.is_email_verified === 'boolean' && (
                      <div className="account-row static">
                        <MailIcon />
                        <span className="account-row-label">{t('nav.email')}</span>
                        <span
                          className="account-row-value"
                          style={user.is_email_verified ? undefined : { color: 'var(--pending)' }}
                        >
                          {user.is_email_verified ? t('nav.emailVerified') : t('nav.emailUnverified')}
                        </span>
                      </div>
                    )}
                    <button className="account-row danger" onClick={handleLogout}>
                      {t('nav.signOut')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className="nav-icon-btn" onClick={toggleTheme} aria-label={t('nav.darkMode')} title={t('nav.darkMode')}>
                  {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                </button>
                <button className="nav-icon-btn" onClick={() => setShowLanguagePopup(true)} aria-label={t('nav.language')} title={currentLanguageName}>
                  <GlobeIcon />
                </button>
                <Link to="/sign-up" className="btn btn-acc">
                  {t('nav.getStarted')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      {showLanguagePopup && <LanguagePopup onClose={() => setShowLanguagePopup(false)} />}
    </header>
  )
}
