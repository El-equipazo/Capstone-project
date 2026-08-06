import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../api/client'
import PasswordField from '../components/PasswordField'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (!token) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <h1 className="h2" style={{ marginBottom: 8 }}>Missing reset link</h1>
            <p className="lead" style={{ marginBottom: 20 }}>
              This page expects a reset link with a token — check that you followed the full link,
              or request a new one.
            </p>
            <Link to="/forgot-password" className="btn btn-acc">
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 440 }}>
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <h1 className="h2" style={{ marginBottom: 8 }}>Password reset</h1>
            <p className="lead" style={{ marginBottom: 20 }}>
              Your password has been updated. Sign in with your new password.
            </p>
            <Link to="/login" className="btn btn-acc">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err.body?.error?.message ?? 'This link is invalid or has expired.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 420 }}>
        <h1 className="h2" style={{ marginBottom: 6 }}>Reset your password</h1>
        <p className="lead" style={{ marginBottom: 24 }}>
          Choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <PasswordField
            id="password"
            label="New password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            hint="Minimum 8 characters."
          />

          <PasswordField
            id="confirm"
            label="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <div className="alert alert-error">
              {error}{' '}
              <Link to="/forgot-password">Request a new link</Link>
            </div>
          )}

          <button className="btn btn-acc btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}
