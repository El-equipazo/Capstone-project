import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { authApi, connectionsApi, expertsApi, reviewsApi, threadsApi } from '../api/client'
import PortraitPlaceholder from '../components/PortraitPlaceholder'
import RatingStars from '../components/RatingStars'
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

  const [reviewsData, setReviewsData] = useState({ data: [], pagination: null, aggregate: null })
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsQuery, setReviewsQuery] = useState('')
  const [reviewsMinStars, setReviewsMinStars] = useState(null)
  const [flaggingId, setFlaggingId] = useState(null) // review_id currently showing the report form
  const [flagReason, setFlagReason] = useState('')
  const [flagged, setFlagged] = useState({}) // { [review_id]: true } after a successful report
  const [flagError, setFlagError] = useState('')

  useEffect(() => {
    setReviewsLoading(true)
    reviewsApi.listForExpert(expertId, { page: reviewsPage, limit: 10, q: reviewsQuery, minStars: reviewsMinStars })
      .then(setReviewsData)
      .catch(() => setReviewsData({ data: [], pagination: null, aggregate: null }))
      .finally(() => setReviewsLoading(false))
  }, [expertId, reviewsPage, reviewsQuery, reviewsMinStars])

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
                    {askError && <p style={{ color: 'var(--err, red)', fontSize: 12, marginTop: 4 }}>{askError}</p>}
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

            <section className="xp-section">
              <span className="section-label xp-section-label">Reviews</span>

              <div className="row gap-10" style={{ alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <RatingStars rating={reviewsData.aggregate?.avg_overall} count={reviewsData.aggregate?.count} label="reviews" />
              </div>

              <div className="row gap-8 wrap" style={{ marginBottom: 14 }}>
                <input
                  className="field-input"
                  style={{ maxWidth: 280 }}
                  placeholder="Search reviews…"
                  value={reviewsQuery}
                  onChange={(e) => { setReviewsPage(1); setReviewsQuery(e.target.value) }}
                />
                {[null, 5, 4, 3].map((n) => (
                  <button
                    key={n ?? 'all'}
                    className={`btn btn-sm ${reviewsMinStars === n ? 'btn-acc' : 'btn-ghost'}`}
                    onClick={() => { setReviewsPage(1); setReviewsMinStars(n) }}
                  >
                    {n ? `${n}★+` : 'All'}
                  </button>
                ))}
              </div>

              {reviewsLoading ? (
                <p className="lead" style={{ fontSize: 12.5 }}>Loading reviews…</p>
              ) : reviewsData.data.length === 0 ? (
                <p className="lead" style={{ fontSize: 12.5 }}>No public reviews yet.</p>
              ) : (
                <>
                  <div className="xp-row-list">
                    {reviewsData.data.map((r) => (
                      <div className="xp-row-item xp-row-item-stack" key={r.review_id}>
                        <div className="xp-row-item-top">
                          <span className="label">
                            <RatingStars rating={r.overall_rating} /> {r.review_title}
                          </span>
                          <span className="meta">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        {r.review_body && <span className="meta">{r.review_body}</span>}
                        {r.reviewer_org_name && (
                          <div className="row gap-8 wrap">
                            <span className="tag" style={{ fontSize: 10.5 }}>{r.reviewer_org_name}</span>
                          </div>
                        )}

                        {flagged[r.review_id] ? (
                          <span className="lead" style={{ fontSize: 11 }}>Reported — thank you.</span>
                        ) : flaggingId === r.review_id ? (
                          <div className="row gap-8" style={{ marginTop: 4 }}>
                            <input
                              className="field-input"
                              style={{ fontSize: 11.5 }}
                              placeholder="Why are you reporting this review?"
                              value={flagReason}
                              onChange={(e) => setFlagReason(e.target.value)}
                            />
                            <button
                              className="btn btn-sm"
                              disabled={!flagReason.trim()}
                              onClick={async () => {
                                try {
                                  await reviewsApi.flag(r.review_id, flagReason.trim())
                                  setFlagged((p) => ({ ...p, [r.review_id]: true }))
                                  setFlaggingId(null); setFlagReason('')
                                } catch (err) {
                                  setFlagError(
                                    err.status === 403
                                      ? 'Only participants in this engagement can report this review.'
                                      : err.body?.error?.message || 'Could not submit report.'
                                  )
                                }
                              }}
                            >
                              Submit
                            </button>
                            <button className="btn btn-sm" onClick={() => { setFlaggingId(null); setFlagReason(''); setFlagError('') }}>Cancel</button>
                            {flagError && <span className="lead" style={{ fontSize: 10.5, color: 'var(--err, #e53)' }}>{flagError}</span>}
                          </div>
                        ) : user ? (
                          <button
                            className="btn btn-sm"
                            style={{ padding: '1px 8px', fontSize: 10.5, alignSelf: 'flex-start' }}
                            onClick={() => { setFlaggingId(r.review_id); setFlagReason(''); setFlagError('') }}
                          >
                            Report
                          </button>
                        ) : (
                          <Link to={`/login?next=/experts/${expertId}`} className="lead" style={{ fontSize: 10.5 }}>
                            Sign in to report
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>

                  {reviewsData.pagination && reviewsData.pagination.total_pages > 1 && (
                    <div className="row gap-10" style={{ marginTop: 14, alignItems: 'center' }}>
                      <button className="btn btn-sm" disabled={reviewsPage <= 1} onClick={() => setReviewsPage((p) => p - 1)}>
                        ← Previous
                      </button>
                      <span className="lead" style={{ fontSize: 12 }}>
                        Page {reviewsPage} of {reviewsData.pagination.total_pages}
                      </span>
                      <button
                        className="btn btn-sm"
                        disabled={reviewsPage >= reviewsData.pagination.total_pages}
                        onClick={() => setReviewsPage((p) => p + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
