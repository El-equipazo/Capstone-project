import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { engagementsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { labelize, ENGAGEMENT_TYPE_OPTIONS } from '../utils/format'

const MILESTONE_LABEL = {
  proposed:    'Proposed',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  skipped:     'Skipped',
  blocked:     'Blocked',
}

function milestoneTagClass(s) {
  if (s === 'completed') return 'badge'
  if (s === 'in_progress') return 'badge'
  return 'tag'
}

function engagementBadgeClass(s) {
  if (s === 'active' || s === 'completed') return 'badge'
  return 'tag'
}

function getStatusActions(engStatus, role) {
  const actions = []
  if (engStatus === 'scoping' && role === 'expert')
    actions.push({ label: 'Send Proposal', newStatus: 'proposal_sent' })
  // proposal_sent for org is handled by the dedicated timeline review UI below
  if (engStatus === 'proposal_accepted')
    actions.push({ label: 'Start Engagement', newStatus: 'active', primary: true })
  if (engStatus === 'active' && role === 'expert')
    actions.push({ label: 'Mark Complete', newStatus: 'completed', confirm: true })
  if (engStatus === 'active')
    actions.push({ label: 'Put on Hold', newStatus: 'on_hold' })
  if (engStatus === 'on_hold')
    actions.push({ label: 'Resume', newStatus: 'active', primary: true })
  if (!['completed', 'cancelled'].includes(engStatus))
    actions.push({ label: 'Cancel', newStatus: 'cancelled', danger: true, confirm: true })
  return actions
}

const BLANK_FORM = { title: '', description: '', due_date: '', deliverable_description: '' }

export default function EngagementDetail() {
  const { id } = useParams()
  const engagementId = parseInt(id, 10)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(BLANK_FORM)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const [timelineReviewMode, setTimelineReviewMode] = useState(null) // null | 'request_changes' | 'decline'
  const [feedbackText, setFeedbackText] = useState('')

  const [editingType, setEditingType] = useState(false)
  const [typeValue, setTypeValue] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    engagementsApi.getById(engagementId)
      .then((eng) => { setEngagement(eng); setLoading(false) })
      .catch(() => { setError('Engagement not found or access denied.'); setLoading(false) })
  }, [user, engagementId, navigate])

  if (!user) return null
  if (loading) return <div className="page"><div className="container"><p className="lead">Loading…</p></div></div>
  if (!engagement) return (
    <div className="page">
      <div className="container">
        <div className="alert alert-error">{error || 'Engagement not found.'}</div>
      </div>
    </div>
  )

  const role = user.role
  const milestones = engagement.milestones || []
  const isTerminal = ['completed', 'cancelled'].includes(engagement.status)
  const backPath = role === 'expert' ? '/dashboard' : '/organization'
  const statusActions = getStatusActions(engagement.status, role)

  async function handleTimelineDecision(decision) {
    setActionLoading(true)
    setError('')
    try {
      let patch
      if (decision === 'accept') {
        patch = { status: 'proposal_accepted' }
      } else if (decision === 'request_changes') {
        patch = { status: 'scoping', proposal_feedback: feedbackText }
      } else {
        patch = { status: 'cancelled', cancellation_reason: feedbackText }
      }
      const updated = await engagementsApi.update(engagementId, patch)
      setEngagement((prev) => ({ ...updated, milestones: prev.milestones }))
      setTimelineReviewMode(null)
      setFeedbackText('')
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to update.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStatusAction(action) {
    if (action.confirm) {
      const msg = action.newStatus === 'cancelled'
        ? 'Cancel this engagement? This cannot be undone.'
        : 'Mark this engagement as complete?'
      if (!window.confirm(msg)) return
    }
    setActionLoading(true)
    setError('')
    try {
      const updated = await engagementsApi.update(engagementId, { status: action.newStatus })
      setEngagement((prev) => ({ ...updated, milestones: prev.milestones }))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to update status.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddMilestone(e) {
    e.preventDefault()
    setAddLoading(true)
    setAddError('')
    try {
      const data = { title: addForm.title }
      if (addForm.description)              data.description              = addForm.description
      if (addForm.due_date)                 data.due_date                 = addForm.due_date
      if (addForm.deliverable_description)  data.deliverable_description  = addForm.deliverable_description
      const m = await engagementsApi.createMilestone(engagementId, data)
      setEngagement((prev) => ({ ...prev, milestones: [...prev.milestones, m] }))
      setAddForm(BLANK_FORM)
      setShowAdd(false)
    } catch (err) {
      setAddError(err.body?.error?.message ?? 'Failed to add milestone.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleConfirm(milestoneId) {
    setError('')
    try {
      const updated = await engagementsApi.confirmMilestone(engagementId, milestoneId)
      setEngagement((prev) => ({ ...prev, milestones: prev.milestones.map((m) => m.milestone_id === milestoneId ? updated : m) }))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to confirm milestone.')
    }
  }

  async function handleMilestoneStatus(milestoneId, newStatus) {
    setError('')
    try {
      const updated = await engagementsApi.updateMilestone(engagementId, milestoneId, { status: newStatus })
      setEngagement((prev) => ({ ...prev, milestones: prev.milestones.map((m) => m.milestone_id === milestoneId ? updated : m) }))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to update milestone.')
    }
  }

  async function handleDelete(milestoneId) {
    if (!window.confirm('Delete this milestone?')) return
    setError('')
    try {
      await engagementsApi.deleteMilestone(engagementId, milestoneId)
      setEngagement((prev) => ({ ...prev, milestones: prev.milestones.filter((m) => m.milestone_id !== milestoneId) }))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to delete milestone.')
    }
  }

  async function handleSaveEdit(milestoneId) {
    setError('')
    try {
      const updated = await engagementsApi.updateMilestone(engagementId, milestoneId, editForm)
      setEngagement((prev) => ({ ...prev, milestones: prev.milestones.map((m) => m.milestone_id === milestoneId ? updated : m) }))
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      setError(err.body?.error?.message ?? 'Failed to save milestone.')
    }
  }

  return (
    <div className="page">
      <div className="container">

        <Link to={backPath} style={{ fontSize: 12.5, display: 'block', marginBottom: 16, color: 'var(--acc)' }}>
          ← Back to dashboard
        </Link>

        <span className="section-label" style={{ color: 'var(--acc)' }}>engagement</span>
        <div className="row gap-10 wrap" style={{ margin: '8px 0 4px', alignItems: 'center' }}>
          <h1 className="h2">{engagement.title || labelize(engagement.engagement_type)}</h1>
          <span className={engagementBadgeClass(engagement.status)}>
            {engagement.status === 'proposal_sent' && role === 'organization'
              ? 'Proposal Received'
              : labelize(engagement.status)}
          </span>
        </div>

        {/* Counterparty info */}
        {role === 'organization' && engagement.expert_first_name && (
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="section-label" style={{ minWidth: 0 }}>Expert</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {engagement.expert_first_name} {engagement.expert_last_name}
            </span>
            {engagement.expert_is_verified && <span className="badge" style={{ fontSize: 10 }}>Verified</span>}
            {engagement.expert_headline && (
              <span className="lead" style={{ fontSize: 12, marginLeft: 2 }}>· {engagement.expert_headline}</span>
            )}
          </div>
        )}
        {role === 'expert' && engagement.org_name && (
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="section-label" style={{ minWidth: 0 }}>Organization</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{engagement.org_name}</span>
            {engagement.org_is_verified && <span className="badge" style={{ fontSize: 10 }}>Verified</span>}
            {engagement.org_sector && (
              <span className="lead" style={{ fontSize: 12, marginLeft: 2 }}>· {engagement.org_sector}</span>
            )}
          </div>
        )}

        <div className="lead" style={{ fontSize: 12.5, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {editingType ? (
            <>
              <select
                className="field-input"
                style={{ fontSize: 12.5, padding: '2px 6px', height: 'auto', width: 'auto' }}
                value={typeValue}
                onChange={(e) => setTypeValue(e.target.value)}
                autoFocus
              >
                {ENGAGEMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-acc"
                style={{ padding: '2px 10px' }}
                onClick={async () => {
                  try {
                    const updated = await engagementsApi.update(engagementId, { engagement_type: typeValue })
                    setEngagement((prev) => ({ ...updated, milestones: prev.milestones }))
                  } catch (err) {
                    setError(err.body?.error?.message ?? 'Failed to update type.')
                  }
                  setEditingType(false)
                }}
              >
                Save
              </button>
              <button className="btn btn-sm" style={{ padding: '2px 10px' }} onClick={() => setEditingType(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <span>{labelize(engagement.engagement_type)}</span>
              {!isTerminal && (
                <button
                  className="btn btn-sm"
                  style={{ padding: '1px 8px', fontSize: 11 }}
                  onClick={() => { setTypeValue(engagement.engagement_type); setEditingType(true) }}
                >
                  change
                </button>
              )}
            </>
          )}
          {engagement.agreed_budget ? <span>· ${Number(engagement.agreed_budget).toLocaleString()}</span> : null}
          {engagement.payment_structure ? <span>· {labelize(engagement.payment_structure)}</span> : null}
          {engagement.start_date ? <span>· Started {engagement.start_date}</span> : null}
          {engagement.estimated_end_date ? <span>· Est. end {engagement.estimated_end_date}</span> : null}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {/* Expert: org has sent back feedback — show it prominently */}
        {role === 'expert' && engagement.status === 'scoping' && engagement.proposal_feedback && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderLeft: '3px solid var(--acc)', background: 'var(--surface-2, rgba(0,0,0,0.03))' }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, display: 'block', marginBottom: 4 }}>
              The organization requested changes to your proposal
            </span>
            <span style={{ fontSize: 12.5 }}>{engagement.proposal_feedback}</span>
          </div>
        )}

        {/* Org: review the proposed timeline when proposal is sent */}
        {role === 'organization' && engagement.status === 'proposal_sent' && (
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <span className="section-label" style={{ display: 'block', marginBottom: 12 }}>Review Proposed Timeline</span>
            <div className="row gap-10 wrap" style={{ marginBottom: 14 }}>
              {engagement.start_date
                ? <span className="tag">Start: {engagement.start_date}</span>
                : <span className="lead" style={{ fontSize: 12.5 }}>No start date proposed.</span>
              }
              {engagement.estimated_end_date && (
                <span className="tag">Est. end: {engagement.estimated_end_date}</span>
              )}
            </div>
            {engagement.description && (
              <p style={{ fontSize: 12.5, marginBottom: 14 }}>{engagement.description}</p>
            )}

            {timelineReviewMode === null && (
              <div className="row gap-10 wrap">
                <button className="btn btn-acc" disabled={actionLoading} onClick={() => handleTimelineDecision('accept')}>
                  Accept
                </button>
                <button className="btn" onClick={() => setTimelineReviewMode('request_changes')}>
                  Request Changes
                </button>
                <button
                  className="btn"
                  style={{ color: 'var(--danger, #c0392b)' }}
                  onClick={() => setTimelineReviewMode('decline')}
                >
                  Decline
                </button>
              </div>
            )}

            {(timelineReviewMode === 'request_changes' || timelineReviewMode === 'decline') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field-group">
                  <label className="field-label">
                    {timelineReviewMode === 'request_changes' ? 'What needs to change?' : 'Reason for declining'}
                  </label>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={
                      timelineReviewMode === 'request_changes'
                        ? 'e.g. We need the project to start after Q3, and the estimated timeline seems too short…'
                        : 'e.g. We have decided to pursue a different approach…'
                    }
                    autoFocus
                  />
                </div>
                <div className="row gap-8">
                  <button
                    className="btn btn-acc"
                    disabled={!feedbackText.trim() || actionLoading}
                    onClick={() => handleTimelineDecision(timelineReviewMode)}
                  >
                    {actionLoading
                      ? 'Submitting…'
                      : timelineReviewMode === 'request_changes' ? 'Send Feedback' : 'Confirm Decline'}
                  </button>
                  <button className="btn" onClick={() => { setTimelineReviewMode(null); setFeedbackText('') }}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status actions */}
        {statusActions.length > 0 && !isTerminal && (
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <span className="section-label" style={{ display: 'block', marginBottom: 12 }}>Actions</span>
            <div className="row gap-10 wrap">
              {statusActions.map((action) => (
                <button
                  key={action.newStatus}
                  className={`btn${action.primary ? ' btn-acc' : action.danger ? '' : ''}`}
                  style={action.danger ? { color: 'var(--danger, #c0392b)' } : {}}
                  onClick={() => handleStatusAction(action)}
                  disabled={actionLoading}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <p className="lead" style={{ fontSize: 11.5, marginTop: 10 }}>
              Status:{' '}
              <strong>
                {engagement.status === 'proposal_sent' && role === 'organization'
                  ? 'Proposal Received'
                  : labelize(engagement.status)}
              </strong>
              {engagement.status === 'scoping' && role === 'expert' && ' — define milestones and send the proposal when ready'}
              {engagement.status === 'scoping' && role === 'organization' && ' — the expert is preparing the proposal'}
              {engagement.status === 'proposal_sent' && role === 'expert' && ' — waiting for the organization to review and accept'}
              {engagement.status === 'proposal_sent' && role === 'organization' && ' — review the milestones and accept, or request changes'}
              {engagement.status === 'proposal_accepted' && role === 'expert' && ' — both parties have agreed; start when ready'}
              {engagement.status === 'proposal_accepted' && role === 'organization' && ' — both parties have agreed; the expert will start when ready'}
              {engagement.status === 'active' && ' — work is underway'}
              {engagement.status === 'on_hold' && ' — engagement is paused'}
            </p>
          </div>
        )}

        {isTerminal && (
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <span className="lead" style={{ fontSize: 13 }}>
              This engagement is <strong>{labelize(engagement.status)}</strong>
              {engagement.actual_end_date ? ` — ended ${engagement.actual_end_date}` : ''}.
              {engagement.cancellation_reason ? ` Reason: ${engagement.cancellation_reason}` : ''}
            </span>
          </div>
        )}

        {/* Description */}
        {engagement.description && (
          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <span className="section-label" style={{ display: 'block', marginBottom: 8 }}>Description</span>
            <p style={{ fontSize: 13 }}>{engagement.description}</p>
          </div>
        )}

        {/* Milestones */}
        <div className="card" style={{ padding: 22 }}>
          <div className="row gap-10 wrap" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="section-label">Milestones</span>
            {role === 'expert' && !isTerminal && (
              <button className="btn btn-sm" onClick={() => { setShowAdd((v) => !v); setAddError('') }}>
                {showAdd ? 'Cancel' : '+ Add milestone'}
              </button>
            )}
          </div>

          {/* Add milestone form */}
          {showAdd && (
            <form onSubmit={handleAddMilestone} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 18, marginBottom: 18 }}>
              {addError && <div className="alert alert-error">{addError}</div>}
              <div className="field-group">
                <label className="field-label">Title *</label>
                <input className="field-input" required value={addForm.title} onChange={(e) => setAddForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="field-group">
                <label className="field-label">Description</label>
                <textarea className="field-input" rows={2} value={addForm.description} onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="row gap-10">
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Due date</label>
                  <input className="field-input" type="date" value={addForm.due_date} onChange={(e) => setAddForm((p) => ({ ...p, due_date: e.target.value }))} />
                </div>
                <div className="field-group" style={{ flex: 2 }}>
                  <label className="field-label">Deliverable</label>
                  <input className="field-input" value={addForm.deliverable_description} onChange={(e) => setAddForm((p) => ({ ...p, deliverable_description: e.target.value }))} placeholder="What will be delivered?" />
                </div>
              </div>
              <button className="btn btn-acc" type="submit" disabled={addLoading} style={{ alignSelf: 'flex-start' }}>
                {addLoading ? 'Adding…' : 'Add milestone'}
              </button>
            </form>
          )}

          {milestones.length === 0 && (
            <p className="lead" style={{ fontSize: 12.5 }}>
              {role === 'expert'
                ? 'No milestones yet — use "Add milestone" above to define the scope.'
                : 'No milestones have been proposed yet.'}
            </p>
          )}

          {milestones.map((m, idx) => (
            <div
              key={m.milestone_id}
              style={{
                borderBottom: idx < milestones.length - 1 ? '1px solid var(--border)' : 'none',
                paddingBottom: idx < milestones.length - 1 ? 16 : 0,
                marginBottom: idx < milestones.length - 1 ? 16 : 0,
              }}
            >
              {editingId === m.milestone_id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="field-input"
                    value={editForm.title ?? m.title}
                    onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Title"
                  />
                  <textarea
                    className="field-input"
                    rows={2}
                    value={editForm.description ?? (m.description || '')}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Description"
                  />
                  <div className="row gap-10">
                    <input
                      className="field-input"
                      type="date"
                      style={{ flex: 1 }}
                      value={editForm.due_date ?? (m.due_date || '')}
                      onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))}
                    />
                    <input
                      className="field-input"
                      style={{ flex: 2 }}
                      value={editForm.deliverable_description ?? (m.deliverable_description || '')}
                      onChange={(e) => setEditForm((p) => ({ ...p, deliverable_description: e.target.value }))}
                      placeholder="Deliverable"
                    />
                  </div>
                  <div className="row gap-8">
                    <button className="btn btn-sm btn-acc" onClick={() => handleSaveEdit(m.milestone_id)}>Save</button>
                    <button className="btn btn-sm" onClick={() => { setEditingId(null); setEditForm({}) }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="row gap-8 wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="row gap-8" style={{ alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                      <span className={milestoneTagClass(m.status)} style={{ fontSize: 11 }}>
                        {MILESTONE_LABEL[m.status] || m.status}
                      </span>
                    </div>

                    <div className="row gap-6">
                      {/* Expert actions */}
                      {role === 'expert' && (
                        <>
                          {m.status === 'confirmed' && (
                            <button className="btn btn-sm" onClick={() => handleMilestoneStatus(m.milestone_id, 'in_progress')}>
                              Start work
                            </button>
                          )}
                          {m.status === 'in_progress' && (
                            <>
                              <button className="btn btn-sm btn-acc" onClick={() => handleMilestoneStatus(m.milestone_id, 'completed')}>
                                Mark complete
                              </button>
                              <button className="btn btn-sm" onClick={() => handleMilestoneStatus(m.milestone_id, 'blocked')}>
                                Mark blocked
                              </button>
                            </>
                          )}
                          {['proposed', 'confirmed'].includes(m.status) && !isTerminal && (
                            <button className="btn btn-sm" onClick={() => { setEditingId(m.milestone_id); setEditForm({}) }}>
                              Edit
                            </button>
                          )}
                          {m.status === 'proposed' && ['scoping', 'proposal_sent'].includes(engagement.status) && (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger, #c0392b)' }}
                              onClick={() => handleDelete(m.milestone_id)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}

                      {/* Org actions */}
                      {role === 'organization' && (
                        <>
                          {m.status === 'proposed' && (
                            <button className="btn btn-sm btn-acc" onClick={() => handleConfirm(m.milestone_id)}>
                              Confirm
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {m.description && (
                    <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #666)', marginTop: 4 }}>{m.description}</p>
                  )}

                  <div className="row gap-8 wrap" style={{ marginTop: 6 }}>
                    {m.due_date && (
                      <span className="tag" style={{ fontSize: 11 }}>
                        Due {new Date(m.due_date + 'T00:00:00').toLocaleDateString()}
                      </span>
                    )}
                    {m.deliverable_description && (
                      <span style={{ fontSize: 12, color: 'var(--fg-muted, #666)' }}>
                        ↳ {m.deliverable_description}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
