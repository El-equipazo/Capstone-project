import { useState } from 'react'
import { authApi } from '../api/client'

const CONFIRM_PHRASE = 'Delete account'

export default function DeleteAccount({ orgName, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canDelete = confirmText === CONFIRM_PHRASE

  async function handleDelete() {
    if (!canDelete || deleting) return
    setDeleting(true)
    setError('')
    try {
      await authApi.deleteAccount()
      onDeleted()
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 460, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <h2 className="h2" style={{ fontSize: 18 }}>
          Delete &quot;{orgName}&quot; account
        </h2>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field-group">
          <label className="field-label">
            To confirm, type &quot;{CONFIRM_PHRASE}&quot; in the box below
          </label>
          <input
            className="field-input"
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </div>

        <div className="row gap-10">
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canDelete || deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
