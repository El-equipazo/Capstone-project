import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authApi.forgotPassword(email)
      // Same confirmation regardless of whether the email matched an
      // account -- see server/models/user_model.py's request_password_reset
      // docstring for why that response can never differ.
      setSent(true)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h1 className="h2" style={{ marginBottom: 6 }}>Check your email</h1>
              <p className="lead">
                If <strong>{email}</strong> has a Lattice account, we've sent a link to reset its
                password. The link expires in 1 hour.
              </p>
            </div>
            <Link to="/login" className="btn btn-acc btn-block">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 420 }}>
        <h1 className="h2" style={{ marginBottom: 6 }}>Forgot your password?</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Enter the email on your account and we'll send you a link to reset it.
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

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-acc btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>

          <p className="lead" style={{ fontSize: 12.5, textAlign: 'center' }}>
            <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
