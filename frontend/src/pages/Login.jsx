import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [searchParams] = useSearchParams()
  const justRegistered = searchParams.get('justRegistered') === '1'

  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { user } = await login({ email, password })
      const next = searchParams.get('next')
      navigate(next || (user.role === 'organization' ? '/experts' : '/dashboard'))
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

        {justRegistered && (
          <div className="alert alert-success" style={{ marginBottom: 18 }}>
            Account created — sign in below to continue.
          </div>
        )}

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

          <div className="field-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

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
