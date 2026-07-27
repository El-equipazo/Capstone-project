import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { connectionsApi, expertsApi, threadsApi } from '../api/client'
import PortraitPlaceholder from '../components/PortraitPlaceholder'
import { useAuth } from '../context/AuthContext'
import { useThreadChat } from '../hooks/useThreadChat'
import { formatRate, formatCurrencyRange, formatWorkPeriod, labelize, AVAILABILITY_LABEL, ENGAGEMENT_TYPE_OPTIONS } from '../utils/format'

export default function ExpertProfile() {
  const { expertId } = useParams()
  const [expert, setExpert] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [engagementType, setEngagementType] = useState('')
  const [initialMessage, setInitialMessage] = useState('')

  const [threadId, setThreadId] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState('')

  const { user } = useAuth()
  const { messages, loading: chatLoading, sendMessage } = useThreadChat(chatOpen ? threadId : null)

  useEffect(() => {
    setExpert(null)
    setNotFound(false)
    setRequestSent(false)
    setEngagementType('')
    setInitialMessage('')
    expertsApi
      .getById(expertId)
      .then(setExpert)
      .catch(() => setNotFound(true))
  }, [expertId])

  async function handleAskQuestion() {
    setChatError('')
    try {
      const thread = await threadsApi.getOrCreate(Number(expertId))
      setThreadId(thread.thread_id)
      setChatOpen(true)
    } catch (err) {
      setChatError(err.body?.error?.message ?? 'Could not open conversation.')
    }
  }

  async function handleSendChat(e) {
    e.preventDefault()
    if (!chatDraft.trim()) return
    setChatSending(true)
    try {
      await sendMessage(chatDraft.trim())
      setChatDraft('')
    } catch (err) {
      setChatError(err.body?.error?.message ?? 'Failed to send.')
    } finally {
      setChatSending(false)
    }
  }

  async function handleRequestAssessment(e) {
    e.preventDefault()
    setRequesting(true)
    setRequestError('')
    try {
      await connectionsApi.create(Number(expertId), {
        org_stated_need: engagementType || null,
        initial_message: initialMessage.trim() || null,
      })
      setRequestSent(true)
    } catch (err) {
      setRequestError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setRequesting(false)
    }
  }

  if (notFound) {
    return (
      <div className="page xp-page">
        <div className="container empty-state">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Expert profile not found</p>
          <Link to="/experts" className="btn btn-sm">
            ← Back to directory
          </Link>
        </div>
      </div>
    )
  }

  if (!expert) {
    return (
      <div className="page xp-page">
        <div className="container">
          <p className="lead">Loading profile…</p>
        </div>
      </div>
    )
  }

  // POST /connections is Auth: organization — only render the actionable CTA
  // for a confirmed organization account. Anonymous/expert/admin visitors get
  // an explanatory message instead (with a sign-in link for anonymous ones)
  // rather than a button that would either no-op or 403 against a real API.
  const canRequestAssessment = user?.role === 'organization'
  const unavailable = expert.availability_status === 'unavailable'

  return (
    <div className="page xp-page">
      <div className="container xp-container">
        <Link to="/experts" className="lead" style={{ fontSize: 12, display: 'inline-block', marginBottom: 22 }}>
          ← Back to directory
        </Link>

        <div className="xp-topbar">
          <span className="section-label">Expert profile</span>
          <span className="section-label">№{String(expert.expert_profile_id).padStart(2, '0')}</span>
        </div>

        <div className="xp-hero">
          <div className="xp-photo">
            <PortraitPlaceholder />
          </div>
          <div className="xp-index">
            <div className="xp-status-row">
              <span className="xp-status-dot" style={{ opacity: unavailable ? 0.3 : 1 }} />
              {AVAILABILITY_LABEL[expert.availability_status]}
            </div>
            <div className="xp-substat">{expert.years_of_experience} yrs experience</div>
          </div>
        </div>

        <h1 className="xp-name">
          {expert.first_name} {expert.last_name}.
        </h1>

        <div className="xp-role-row">
          <span className="xp-role">
            {expert.headline}
            {expert.is_verified && ' · Verified'}
          </span>
          {expert.linkedin_url && (
            <a href={expert.linkedin_url} target="_blank" rel="noreferrer" className="xp-link-arrow">
              LinkedIn ↗
            </a>
          )}
        </div>

        <section className="xp-section">
          <span className="section-label xp-section-label">About</span>
          <p className="xp-about-text">{expert.bio}</p>
        </section>

        {expert.specializations.length > 0 && (
          <section className="xp-section">
            <span className="section-label xp-section-label">Specializations</span>
            <div className="xp-plain-list">
              {expert.specializations.map((s) => (
                <span key={s.specialization_id}>
                  {labelize(s.specialization)} <span className="xp-muted-inline">({labelize(s.proficiency_level)})</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {expert.credentials.length > 0 && (
          <section className="xp-section">
            <span className="section-label xp-section-label">Credentials &amp; certifications</span>
            <div className="xp-row-list">
              {expert.credentials.map((c) => (
                <div className="xp-row-item" key={c.credential_id}>
                  <span className="label">{c.credential_name}</span>
                  <span className="meta">
                    {c.institution} · {c.year_obtained} · {c.is_verified ? 'Verified' : 'Pending verification'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {expert.work_history.length > 0 && (
          <section className="xp-section">
            <span className="section-label xp-section-label">Work history</span>
            <div className="xp-row-list">
              {expert.work_history.map((w) => (
                <div className="xp-row-item xp-row-item-stack" key={w.work_history_id}>
                  <div className="xp-row-item-top">
                    <span className="label">
                      {w.job_title} — {w.organization_name}
                    </span>
                    <span className="meta">{formatWorkPeriod(w.start_date, w.end_date)}</span>
                  </div>
                  {w.description && <span className="meta">{w.description}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {expert.sector_experience.length > 0 && (
          <section className="xp-section">
            <span className="section-label xp-section-label">Sector experience &amp; compliance</span>
            <div className="xp-row-list">
              {expert.sector_experience.map((s) => (
                <div className="xp-row-item xp-row-item-stack" key={s.sector_exp_id}>
                  <div className="xp-row-item-top">
                    <span className="label">{labelize(s.sector)}</span>
                    <span className="meta">{s.years_experience_in_sector} yrs in sector</span>
                  </div>
                  <span className="meta">{s.compliance_standards_known.join(', ')}</span>
                  {s.anonymized_client_examples && <span className="meta">{s.anonymized_client_examples}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {expert.engagement_types.length > 0 && (
          <section className="xp-section">
            <span className="section-label xp-section-label">Engagement types &amp; estimated timelines</span>
            <div className="xp-row-list">
              {expert.engagement_types.map((t) => (
                <div className="xp-row-item xp-row-item-stack" key={t.eng_type_id}>
                  <div className="xp-row-item-top">
                    <span className="label">{labelize(t.engagement_type)}</span>
                    <span className="meta">
                      {t.typical_duration_weeks_min}–{t.typical_duration_weeks_max} weeks
                    </span>
                  </div>
                  <span className="meta">{t.approach_description}</span>
                  <span className="meta">Typical budget: {formatCurrencyRange(t.typical_budget_min, t.typical_budget_max)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="xp-connect-card">
          <div className="xp-connect-left">
            <span className="section-label xp-section-label">Request engagement</span>
            {canRequestAssessment ? (
              requestSent ? (
                <p className="xp-connect-text">Request sent — {expert.first_name} has been notified.</p>
              ) : unavailable ? (
                <p className="xp-connect-text" style={{ opacity: 0.6 }}>This expert is currently unavailable.</p>
              ) : (
                <form onSubmit={handleRequestAssessment} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <div className="field-group">
                    <label className="field-label">Type of engagement</label>
                    <select
                      className="field-input"
                      value={engagementType}
                      onChange={(e) => setEngagementType(e.target.value)}
                    >
                      <option value="">Not sure — let the expert decide</option>
                      {ENGAGEMENT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Message <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                    <textarea
                      className="field-input"
                      rows={2}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder={`Briefly describe what you're looking for…`}
                    />
                  </div>
                  {requestError && <p style={{ color: 'var(--err, red)', fontSize: 12, margin: 0 }}>{requestError}</p>}
                  <button className="xp-tap-link" type="submit" disabled={requesting} style={{ alignSelf: 'flex-start' }}>
                    {requesting ? 'Sending…' : 'Send request ↗'}
                  </button>
                </form>
              )
            ) : !user ? (
              <p className="xp-connect-text">
                <Link to={`/login?next=/experts/${expertId}`} className="xp-link-arrow">
                  Sign in as an organization
                </Link>{' '}
                to request an engagement.
              </p>
            ) : (
              <p className="xp-connect-text">Only organizations can request engagements.</p>
            )}
          </div>
          <div className="xp-dot-pattern" />
        </div>

        {canRequestAssessment && (
          <div style={{ marginTop: 10 }}>
            {chatError && <p style={{ color: 'var(--err, red)', fontSize: 12, marginBottom: 6 }}>{chatError}</p>}
            {!chatOpen ? (
              <button className="btn btn-sm" onClick={handleAskQuestion}>
                Ask a question
              </button>
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="section-label">Conversation with {expert.first_name}</span>
                  <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, opacity: 0.5 }}>×</button>
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {chatLoading ? (
                    <p className="lead" style={{ fontSize: 12 }}>Loading…</p>
                  ) : messages.length === 0 ? (
                    <p className="lead" style={{ fontSize: 12, opacity: 0.6 }}>No messages yet — ask away.</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.message_id}
                        style={{
                          alignSelf: m.sender_id === user.user_id ? 'flex-end' : 'flex-start',
                          background: m.sender_id === user.user_id ? 'var(--acc)' : 'var(--srf)',
                          color: m.sender_id === user.user_id ? '#fff' : 'inherit',
                          borderRadius: 8,
                          padding: '6px 10px',
                          maxWidth: '75%',
                          fontSize: 13,
                        }}
                      >
                        {m.content}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="Type a message…"
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-sm" type="submit" disabled={chatSending || !chatDraft.trim()}>
                    {chatSending ? '…' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <div className="xp-stats-row">
          <div className="xp-stat-block">
            <span className="section-label xp-section-label">Rating</span>
            <div className="value">{expert.avg_rating ? `${expert.avg_rating.toFixed(1)} ↗` : 'New ↗'}</div>
          </div>
          <div className="xp-stat-block">
            <span className="section-label xp-section-label">Rate</span>
            <div className="value">{formatRate(expert.hourly_rate_min, expert.hourly_rate_max)} ↗</div>
          </div>
        </div>
      </div>
    </div>
  )
}
