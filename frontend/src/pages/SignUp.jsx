import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignUp() {
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'expert' ? 'expert' : 'organization'

  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register({ email, password, role })
      navigate(`/login?justRegistered=1&email=${encodeURIComponent(email)}`)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <h1 className="h2" style={{ marginBottom: 6 }}>
          Create your account
        </h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Choose the role that matches why you&apos;re here — you can complete your full profile
          after signing in.
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
