import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { landingPathFor } from '../utils/format'
import PasswordField from '../components/PasswordField'

// Only ever redirect to a same-site path — an absolute URL is blocked by
// React Router already, but a protocol-relative "//evil.com" isn't, so
// require a leading "/" that isn't itself the start of "//".
function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export default function Login() {
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { user, login } = useAuth()
  const navigate = useNavigate()

  // Already signed in — bounce to their dashboard (or wherever `next` points)
  // rather than showing a login form to someone who's already authenticated.
  useEffect(() => {
    if (user) navigate(safeNext(searchParams.get('next')) || landingPathFor(user.role), { replace: true })
  }, [user, searchParams, navigate])

  if (user) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { user } = await login({ email, password })
      navigate(safeNext(searchParams.get('next')) || landingPathFor(user.role))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 420 }}>
        <h1 className="h2" style={{ marginBottom: 6 }}>
          Sign in
        </h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Welcome back to Lattice.
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="field-group">
            <label className="field-label" htmlFor="email">
              Email
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

          <PasswordField
            id="password"
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />

          <Link to="/forgot-password" style={{ fontSize: 12.5, alignSelf: 'flex-end', marginTop: -8 }}>
            Forgot password?
          </Link>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-acc btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="lead" style={{ fontSize: 12.5, textAlign: 'center' }}>
            New to Lattice? <Link to="/sign-up">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
