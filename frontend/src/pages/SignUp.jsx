import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { landingPathFor } from '../utils/format'

export default function SignUp() {
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'expert' ? 'expert' : 'organization'

  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Set once registration succeeds. `verifyLink` holds the verification link
  // directly when email sending isn't configured (see user_model.create());
  // `emailSent` means Resend actually mailed it instead. Exactly one of the
  // two is ever set, and either one gates the confirmation screen below,
  // which the sign-in redirect effect must not skip past.
  const [verifyLink, setVerifyLink] = useState(null)
  const [emailSent, setEmailSent] = useState(false)

  const { user, register, login, refreshUser } = useAuth()
  const navigate = useNavigate()

  // Already signed in — bounce to their dashboard rather than showing a form
  // to create a second account (or a stale "sign in" link back to /login).
  // Skipped once verifyLink/emailSent is set: handleSubmit already signed
  // the user in to reach that screen, and this effect would otherwise
  // navigate away from it the instant `user` becomes truthy.
  const showingConfirmation = Boolean(verifyLink) || emailSent

  useEffect(() => {
    if (user && !showingConfirmation) navigate(landingPathFor(user.role), { replace: true })
  }, [user, showingConfirmation, navigate])

  if (user && !showingConfirmation) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const registered = await register({ email, password, role })
      // Set before login() rather than after: login() makes `user` truthy,
      // and if neither were set yet at that instant, the "already signed
      // in" redirect effect below would fire and navigate away before this
      // screen ever renders.
      if (registered.verification_token) {
        setVerifyLink(`${window.location.origin}/verify-email?token=${registered.verification_token}`)
      } else {
        setEmailSent(true)
      }
      await login({ email, password })
      // Populates is_email_verified on the session's user object -- login()
      // alone only stores {user_id, email, role}, and the navbar's status
      // row would otherwise show nothing until the next /auth/me call
      // (e.g. on the dashboard's own mount effect).
      await refreshUser().catch(() => {})
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h1 className="h2" style={{ marginBottom: 6 }}>Confirm your email</h1>
              <p className="lead">
                We've sent a verification link to <strong>{email}</strong>. Check your inbox and
                click the link to confirm your account.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-acc btn-block"
              onClick={() => navigate(landingPathFor(user?.role))}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (verifyLink) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h1 className="h2" style={{ marginBottom: 6 }}>Confirm your email</h1>
              <p className="lead">
                We'd normally send a verification link to <strong>{email}</strong>. This project
                doesn't have an email service configured yet, so here's that link directly:
              </p>
            </div>

            <div className="field-group">
              <label className="field-label">Verification link</label>
              <input className="field-input" readOnly value={verifyLink} onFocus={(e) => e.target.select()} />
            </div>

            <div className="row gap-8 wrap">
              <a href={verifyLink} className="btn btn-acc">
                Verify now
              </a>
              <button
                type="button"
                className="btn"
                onClick={() => navigate(landingPathFor(user?.role))}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <h1 className="h2" style={{ marginBottom: 6 }}>
          Create your account
        </h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Choose the role that matches why you&apos;re here — you can complete your full profile
          once you&apos;re in.
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="field-group">
            <span className="field-label">I am signing up as a...</span>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-option ${role === 'organization' ? 'on' : ''}`}
                onClick={() => setRole('organization')}
              >
                <div className="title">Organization</div>
                <div className="sub">Looking to assess &amp; remediate quantum risk</div>
              </button>
              <button
                type="button"
                className={`role-option ${role === 'expert' ? 'on' : ''}`}
                onClick={() => setRole('expert')}
              >
                <div className="title">Expert</div>
                <div className="sub">Offering quantum security expertise</div>
              </button>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.com"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <span className="field-hint">Minimum 8 characters.</span>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-acc btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="lead" style={{ fontSize: 12.5, textAlign: 'center' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
