import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { authApi, connectionsApi, expertsApi, threadsApi } from '../api/client'
import PortraitPlaceholder from '../components/PortraitPlaceholder'
import { useAuth } from '../context/AuthContext'
import { useChat_context } from '../context/ChatContext'
import { formatRate, formatCurrencyRange, formatWorkPeriod, formatYearsOfExperience, labelize, AVAILABILITY_LABEL, ENGAGEMENT_TYPE_OPTIONS } from '../utils/format'

const EXPAND_THRESHOLD = 3

// Blank fields (bio, specializations, ...) get a neutral placeholder for
// visitors, but an actionable one for the profile's own owner -- checked via
// authApi.me() below, since experts can view their own public profile page
// (the "View public profile" link on their dashboard).
function EmptyState({ isOwner, ownerText, ownerLinkText, visitorText }) {
  if (isOwner) {
    return (
      <p className="xp-placeholder owner">
        {ownerText} <Link to="/dashboard">{ownerLinkText} →</Link>
      </p>
    )
  }
  return <p className="xp-placeholder">{visitorText}</p>
}

// Shared collapse-behind-"show more" behavior for the longer list sections
// (credentials, work history, sector experience, engagement types) -- a full
// profile otherwise renders as one long, undifferentiated scroll.
function ExpandableList({ items, keyFn, renderItem }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, EXPAND_THRESHOLD)
  const hiddenCount = items.length - EXPAND_THRESHOLD

  return (
    <>
      <div className="xp-row-list">
        {visible.map((item) => (
          <div key={keyFn(item)}>{renderItem(item)}</div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button className="xp-expand-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less ▲' : `Show ${hiddenCount} more ▾`}
        </button>
      )}
    </>
  )
}

export default function ExpertProfile() {
  const { expertId } = useParams()
  const [expert, setExpert] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [engagementType, setEngagementType] = useState('')
  const [initialMessage, setInitialMessage] = useState('')
  const [isOwner, setIsOwner] = useState(false)

  const { user } = useAuth()
  const { openChat } = useChat_context()
  const [searchParams] = useSearchParams()
  const [askError, setAskError] = useState('')
  const [askLoading, setAskLoading] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'expert') {
      setIsOwner(false)
      return
    }
    let cancelled = false
    authApi
      .me()
      .then(({ profile }) => {
        if (!cancelled) setIsOwner(profile?.expert_profile_id === Number(expertId))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user, expertId])

  async function handleAskQuestion() {
    setAskError('')
    setAskLoading(true)
    try {
      const thread = await threadsApi.getOrCreate(Number(expertId))
      openChat(thread.thread_id, `${expert.first_name} ${expert.last_name}`)
    } catch {
      setAskError('Could not open conversation. Please try again.')
    } finally {
      setAskLoading(false)
    }
  }

  // Notification deep-link: /experts/:id?open_thread=X opens the chat immediately.
  useEffect(() => {
    const threadId = searchParams.get('open_thread')
    if (!threadId || !expert) return
    openChat(parseInt(threadId, 10), `${expert.first_name} ${expert.last_name}`)
  }, [searchParams, expert, openChat])

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

        <div className="xp-layout">
          <aside className="xp-sidebar">
            <div className="xp-hero">
              <div className="xp-photo">
                {expert.profile_photo_url ? (
                  <img src={expert.profile_photo_url} alt="" className="xp-photo-img" />
                ) : (
                  <PortraitPlaceholder />
                )}
              </div>
              <div className="xp-index">
                <div className="xp-status-row">
                  <span className="xp-status-dot" style={{ opacity: unavailable ? 0.3 : 1 }} />
                  {AVAILABILITY_LABEL[expert.availability_status]}
                </div>
                {formatYearsOfExperience(expert.years_of_experience) != null && (
                  <div className="xp-substat">{formatYearsOfExperience(expert.years_of_experience)} yrs experience</div>
                )}
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

            <div className="xp-stats-row">
              <div className="xp-stat-block">
                <span className="section-label xp-section-label">Rating</span>
                <div className="value">{expert.avg_rating ? expert.avg_rating.toFixed(1) : 'New'}</div>
              </div>
              <div className="xp-stat-block">
                <span className="section-label xp-section-label">Rate</span>
                <div className="value">{formatRate(expert.hourly_rate_min, expert.hourly_rate_max)}</div>
              </div>
            </div>

            <div className="xp-connect-card">
              <div className="xp-connect-left">
                <span className="section-label xp-section-label">Request engagement</span>
                {canRequestAssessment && (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      className="btn btn-sm"
                      onClick={handleAskQuestion}
                      disabled={askLoading}
                    >
                      {askLoading ? 'Opening…' : 'Ask a question'}
                    </button>
                    {askError && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{askError}</p>}
                  </div>
                )}
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
                      {requestError && <p style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>{requestError}</p>}
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
          </aside>

          <div className="xp-main">
            <section className="xp-section">
              <span className="section-label xp-section-label">Specializations</span>
              {expert.specializations.length > 0 ? (
                <div className="xp-plain-list">
                  {expert.specializations.map((s) => (
                    <span key={s.specialization_id} className="xp-spec-item">
                      {labelize(s.specialization)}
                      <span className={`xp-prof-tag ${s.proficiency_level}`}>{labelize(s.proficiency_level)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="Add at least one specialization so organizations can find you."
                  ownerLinkText="Add specializations"
                  visitorText="No specializations listed yet."
                />
              )}
            </section>

            <section className="xp-section">
              <span className="section-label xp-section-label">Credentials &amp; certifications</span>
              {expert.credentials.length > 0 ? (
                <ExpandableList
                  items={expert.credentials}
                  keyFn={(c) => c.credential_id}
                  renderItem={(c) => (
                    <div className="xp-row-item">
                      <span className="label">{c.credential_name}</span>
                      <span className="status">
                        <span className="meta">{c.institution} · {c.year_obtained}</span>
                        <span className={`badge ${c.is_verified ? '' : 'pending'}`}>
                          {c.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </span>
                    </div>
                  )}
                />
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="You haven't added any credentials yet."
                  ownerLinkText="Add credentials"
                  visitorText="No credentials listed yet."
                />
              )}
            </section>

            <section className="xp-section">
              <span className="section-label xp-section-label">About</span>
              {expert.bio ? (
                <p className="xp-about-text">{expert.bio}</p>
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="You haven't added a bio yet."
                  ownerLinkText="Add one from your dashboard"
                  visitorText="This expert hasn't added a bio yet."
                />
              )}
            </section>

            <section className="xp-section">
              <span className="section-label xp-section-label">Work history</span>
              {expert.work_history.length > 0 ? (
                <ExpandableList
                  items={expert.work_history}
                  keyFn={(w) => w.work_history_id}
                  renderItem={(w) => (
                    <div className="xp-row-item xp-row-item-stack">
                      <div className="xp-row-item-top">
                        <span className="label">
                          {w.job_title} — {w.organization_name}
                        </span>
                        <span className="meta">{formatWorkPeriod(w.start_date, w.end_date)}</span>
                      </div>
                      {w.description && <span className="meta">{w.description}</span>}
                    </div>
                  )}
                />
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="You haven't added your work history yet."
                  ownerLinkText="Add work history"
                  visitorText="No work history listed yet."
                />
              )}
            </section>

            <section className="xp-section">
              <span className="section-label xp-section-label">Sector experience &amp; compliance</span>
              {expert.sector_experience.length > 0 ? (
                <ExpandableList
                  items={expert.sector_experience}
                  keyFn={(s) => s.sector_exp_id}
                  renderItem={(s) => (
                    <div className="xp-row-item xp-row-item-stack">
                      <div className="xp-row-item-top">
                        <span className="label">{labelize(s.sector)}</span>
                        <span className="meta">{s.years_experience_in_sector} yrs in sector</span>
                      </div>
                      <span className="meta">{s.compliance_standards_known.join(', ')}</span>
                      {s.anonymized_client_examples && <span className="meta">{s.anonymized_client_examples}</span>}
                    </div>
                  )}
                />
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="You haven't added sector experience yet."
                  ownerLinkText="Add sector experience"
                  visitorText="No sector experience listed yet."
                />
              )}
            </section>

            <section className="xp-section">
              <span className="section-label xp-section-label">Engagement types &amp; estimated timelines</span>
              {expert.engagement_types.length > 0 ? (
                <ExpandableList
                  items={expert.engagement_types}
                  keyFn={(t) => t.eng_type_id}
                  renderItem={(t) => (
                    <div className="xp-row-item xp-row-item-stack">
                      <div className="xp-row-item-top">
                        <span className="label">{labelize(t.engagement_type)}</span>
                        <span className="meta">
                          {t.typical_duration_weeks_min}–{t.typical_duration_weeks_max} weeks
                        </span>
                      </div>
                      <span className="meta">{t.approach_description}</span>
                      <span className="meta">Typical budget: {formatCurrencyRange(t.typical_budget_min, t.typical_budget_max)}</span>
                    </div>
                  )}
                />
              ) : (
                <EmptyState
                  isOwner={isOwner}
                  ownerText="You haven't described your engagement types yet."
                  ownerLinkText="Add engagement types"
                  visitorText="No engagement types listed yet."
                />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
