import { useState } from 'react'
import { authApi } from '../api/client'
import PasswordField from './PasswordField'

export default function ChangePasswordCard() {
  const [form, setForm] = useState({ current_password: '', password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const update = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }))
    setSaved(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (form.password !== form.confirm) {
      setError('New passwords do not match.')
      return
    }

    setSaving(true)
    try {
      await authApi.updateMe({
        current_password: form.current_password,
        password: form.password,
      })
      setForm({ current_password: '', password: '', confirm: '' })
      setSaved(true)
    } catch (err) {
      setError(err.body?.error?.message || 'Could not update password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <span className="section-label">Password</span>

      <PasswordField
        label="Current password"
        required
        autoComplete="current-password"
        value={form.current_password}
        onChange={(e) => update('current_password', e.target.value)}
      />

      <div className="row gap-10">
        <div style={{ flex: 1 }}>
          <PasswordField
            label="New password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <PasswordField
            label="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => update('confirm', e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Password updated.</div>}

      <button className="btn btn-sm btn-acc" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
