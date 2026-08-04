import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { landingPathFor } from '../utils/format'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user, refreshUser } = useAuth()

  const [status, setStatus] = useState(token ? 'checking' : 'missing') // 'checking' | 'success' | 'error' | 'missing'
  const [error, setError] = useState('')
  // The token is single-use server-side; React 18 StrictMode's dev-only
  // double-invoke of effects would otherwise fire this twice, and the
  // second call would fail against an already-consumed token and stomp
  // the first call's success state.
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!token || requestedRef.current) return
    requestedRef.current = true
    authApi.verifyEmail(token)
      .then(async () => {
        // Refresh the signed-in user's session (if any) so the navbar's
        // status row reflects this immediately, rather than staying stale
        // until something else happens to call it later.
        if (user) await refreshUser().catch(() => {})
        setStatus('success')
      })
      .catch((err) => {
        setError(err.body?.error?.message ?? 'This link is invalid or has expired.')
        setStatus('error')
      })
    // Deliberately excludes user/refreshUser -- this should only ever run
    // once per token, not re-fire if the auth session happens to change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const continuePath = user ? landingPathFor(user.role) : '/login'

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          {status === 'checking' && (
            <>
              <h1 className="h2" style={{ marginBottom: 8 }}>Verifying your email…</h1>
              <p className="lead">One moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="h2" style={{ marginBottom: 8 }}>Email verified</h1>
              <p className="lead" style={{ marginBottom: 20 }}>
                Thanks — your email address is confirmed.
              </p>
              <Link to={continuePath} className="btn btn-acc">
                Continue
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="h2" style={{ marginBottom: 8 }}>Verification failed</h1>
              <p className="lead" style={{ marginBottom: 20 }}>{error}</p>
              <Link to={continuePath} className="btn">
                Continue anyway
              </Link>
            </>
          )}

          {status === 'missing' && (
            <>
              <h1 className="h2" style={{ marginBottom: 8 }}>Missing verification link</h1>
              <p className="lead" style={{ marginBottom: 20 }}>
                This page expects a verification link with a token — check that you followed the
                full link.
              </p>
              <Link to={continuePath} className="btn">
                Continue anyway
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
