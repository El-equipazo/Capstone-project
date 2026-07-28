import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { labelize, AVAILABILITY_LABEL } from '../utils/format'

const ROLE_COLOR = {
  expert: '#059669',
  organization: '#2563eb',
  admin: '#7c3aed',
}

const AI_RECOMMENDATION_STYLE = {
  approve: { background: '#059669', borderColor: '#059669', color: '#fff' },
  reject: { background: '#dc2626', borderColor: '#dc2626', color: '#fff' },
}

const AI_REVIEW_ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI review isn’t set up on this server yet. Ask an admin to configure it.',
  AI_UNAVAILABLE: 'The AI review service is temporarily unavailable. Please try again in a moment.',
}

function VerifiedBadge({ isVerified, status }) {
  return isVerified ? (
    <span className="badge">✓ Verified</span>
  ) : (
    <span className="badge pending">{labelize(status ?? 'unsubmitted')}</span>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('experts')
  const [error, setError] = useState('')

  const [stats, setStats] = useState({ totalExperts: 0, verifiedExperts: 0, totalOrgs: 0, activeOrgs: 0 })

  const [experts, setExperts] = useState([])
  const [expertsLoading, setExpertsLoading] = useState(true)
  const [expertFilter, setExpertFilter] = useState('all')
  const [verifyingExpert, setVerifyingExpert] = useState({})
  const [deactivatingExpert, setDeactivatingExpert] = useState({})

  const [orgs, setOrgs] = useState([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [deactivatingOrg, setDeactivatingOrg] = useState({})

  const [verifications, setVerifications] = useState([])
  const [verifsLoading, setVerifsLoading] = useState(true)
  const [vFilter, setVFilter] = useState('pending')
  const [pendingCount, setPendingCount] = useState(0)
  const [deciding, setDeciding] = useState({})
  const [vNotes, setVNotes] = useState({})
  const [aiReviewing, setAiReviewing] = useState({})
  const [aiReviewError, setAiReviewError] = useState({})

  async function loadExperts(filter) {
    setExpertsLoading(true)
    try {
      const params = filter === 'verified' ? { is_verified: true } : filter === 'unverified' ? { is_verified: false } : {}
      const data = await adminApi.listExpertProfiles(params)
      setExperts(data)
      return data
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setExpertsLoading(false)
    }
  }

  async function loadOrgs() {
    setOrgsLoading(true)
    try {
      const data = await adminApi.listOrganizationProfiles()
      setOrgs(data)
      return data
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setOrgsLoading(false)
    }
  }

  async function loadVerifications(filterStatus) {
    setVerifsLoading(true)
    try {
      const params = filterStatus && filterStatus !== 'all' ? { status: filterStatus } : {}
      const data = await adminApi.listVerifications(params)
      setVerifications(data)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setVerifsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) { navigate('/login?next=/admin'); return }
    if (user.role !== 'admin') return
    Promise.all([loadExperts('all'), loadOrgs()]).then(([expertData, orgData]) => {
      if (expertData && orgData) {
        setStats({
          totalExperts: expertData.length,
          verifiedExperts: expertData.filter((e) => e.is_verified).length,
          totalOrgs: orgData.length,
          activeOrgs: orgData.filter((o) => o.is_active).length,
        })
      }
    })
    loadVerifications('pending')
    adminApi.listVerifications({ status: 'pending' }).then((d) => setPendingCount(d.length)).catch(() => {})
  }, [user, navigate])

  async function handleToggleVerifyExpert(e) {
    setVerifyingExpert((p) => ({ ...p, [e.expert_profile_id]: true }))
    setError('')
    try {
      const updated = await adminApi.setExpertVerified(e.expert_profile_id, !e.is_verified)
      setExperts((prev) => prev.map((x) => x.expert_profile_id === updated.expert_profile_id ? { ...x, ...updated } : x))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setVerifyingExpert((p) => ({ ...p, [e.expert_profile_id]: false }))
    }
  }

  async function handleToggleExpert(e) {
    setDeactivatingExpert((p) => ({ ...p, [e.user_id]: true }))
    setError('')
    try {
      const updated = await adminApi.setUserActive(e.user_id, !e.is_active)
      setExperts((prev) => prev.map((x) => x.user_id === updated.user_id ? { ...x, is_active: updated.is_active } : x))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setDeactivatingExpert((p) => ({ ...p, [e.user_id]: false }))
    }
  }

  async function handleToggleOrg(o) {
    setDeactivatingOrg((p) => ({ ...p, [o.user_id]: true }))
    setError('')
    try {
      const updated = await adminApi.setUserActive(o.user_id, !o.is_active)
      setOrgs((prev) => prev.map((x) => x.user_id === updated.user_id ? { ...x, is_active: updated.is_active } : x))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setDeactivatingOrg((p) => ({ ...p, [o.user_id]: false }))
    }
  }

  function setVNote(id, field, value) {
    setVNotes((p) => ({ ...p, [id]: { ...(p[id] || {}), [field]: value } }))
  }

  async function handleDecide(verificationId, action) {
    const notes = vNotes[verificationId] || {}
    const data = action === 'approved'
      ? { status: 'approved', admin_notes: notes.admin_notes || '' }
      : { status: 'rejected', rejection_reason: notes.rejection_reason || '' }
    setDeciding((p) => ({ ...p, [verificationId]: true }))
    setError('')
    try {
      await adminApi.decideVerification(verificationId, data)
      await loadVerifications(vFilter)
      adminApi.listVerifications({ status: 'pending' }).then((d) => setPendingCount(d.length)).catch(() => {})
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setDeciding((p) => ({ ...p, [verificationId]: false }))
    }
  }

  async function handleAIReview(verificationId) {
    setAiReviewing((p) => ({ ...p, [verificationId]: true }))
    setAiReviewError((p) => ({ ...p, [verificationId]: '' }))
    try {
      const updated = await adminApi.reviewVerificationWithAI(verificationId)
      setVerifications((prev) =>
        prev.map((v) => (v.verification_id === verificationId ? { ...v, ...updated } : v))
      )
    } catch (err) {
      const code = err.body?.error?.code
      setAiReviewError((p) => ({
        ...p,
        [verificationId]: AI_REVIEW_ERROR_MESSAGES[code] ?? err.body?.error?.message ?? 'Something went wrong. Please try again.',
      }))
    } finally {
      setAiReviewing((p) => ({ ...p, [verificationId]: false }))
    }
  }

  if (!user) return null

  if (user.role !== 'admin') {
    return (
      <div className="page">
        <div className="container empty-state">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>This dashboard is for admin accounts only</p>
          <Link to="/" className="btn btn-sm">Back to home</Link>
        </div>
      </div>
    )
  }

  const PROFILE_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unverified', label: 'Unverified' },
    { key: 'verified', label: 'Verified' },
  ]

  return (
    <div className="page">
      <div className="container">
        <span className="section-label" style={{ color: 'var(--acc)' }}>admin dashboard</span>
        <div className="row gap-10 wrap" style={{ margin: '10px 0 20px', alignItems: 'baseline' }}>
          <h1 className="h2">Platform Overview</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { v: stats.totalExperts, l: 'experts' },
            { v: stats.verifiedExperts, l: 'verified experts' },
            { v: stats.totalOrgs, l: 'organizations' },
            { v: stats.activeOrgs, l: 'active orgs' },
          ].map(({ v, l }) => (
            <div key={l} className="card" style={{ padding: 18 }}>
              <div className="stat">
                <span className="v">{v}</span>
                <span className="l">{l}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${tab === 'experts' ? 'on' : ''}`} onClick={() => setTab('experts')}>
            Experts
          </button>
          <button className={`dash-tab ${tab === 'organizations' ? 'on' : ''}`} onClick={() => setTab('organizations')}>
            Organizations
          </button>
          <button className={`dash-tab ${tab === 'verifications' ? 'on' : ''}`} onClick={() => setTab('verifications')}>
            Verifications{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: '16px 0' }}>{error}</div>
        )}

        {tab === 'experts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            <div className="row gap-8">
              {PROFILE_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`btn btn-sm ${expertFilter === key ? 'btn-acc' : 'btn-ghost'}`}
                  onClick={() => { setExpertFilter(key); loadExperts(key) }}
                >
                  {label}
                </button>
              ))}
            </div>

            {expertsLoading ? (
              <p className="lead">Loading…</p>
            ) : experts.length === 0 ? (
              <p className="lead">No experts found.</p>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {experts.map((e, i) => (
                  <div
                    key={e.expert_profile_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < experts.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="row gap-8">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{e.first_name} {e.last_name}</span>
                        <VerifiedBadge isVerified={e.is_verified} status={e.verification_status} />
                        {!e.is_active && <span className="badge pending">deactivated</span>}
                        <span className="tag" style={{ fontSize: 11 }}>{AVAILABILITY_LABEL[e.availability_status] ?? e.availability_status}</span>
                      </div>
                      <span className="lead" style={{ fontSize: 12 }}>{e.headline ?? '—'}</span>
                      <span className="lead" style={{ fontSize: 11 }}>{e.email}</span>
                    </div>
                    <div className="row gap-8">
                      <Link to={`/experts/${e.expert_profile_id}`} className="btn btn-ghost btn-sm">View</Link>
                      <button
                        className={`btn btn-sm ${e.is_verified ? 'btn-ghost' : 'btn-acc'}`}
                        disabled={verifyingExpert[e.expert_profile_id]}
                        onClick={() => handleToggleVerifyExpert(e)}
                        style={e.is_verified ? { color: '#dc2626' } : undefined}
                      >
                        {verifyingExpert[e.expert_profile_id] ? '…' : e.is_verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={deactivatingExpert[e.user_id]}
                        onClick={() => handleToggleExpert(e)}
                        style={e.is_active ? { color: '#dc2626' } : undefined}
                      >
                        {deactivatingExpert[e.user_id] ? '…' : e.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'organizations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {orgsLoading ? (
              <p className="lead">Loading…</p>
            ) : orgs.length === 0 ? (
              <p className="lead">No organizations found.</p>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {orgs.map((o, i) => (
                  <div
                    key={o.org_profile_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < orgs.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="row gap-8">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{o.org_name}</span>
                        {!o.is_active && <span className="badge pending">deactivated</span>}
                        {o.sector && <span className="tag" style={{ fontSize: 11 }}>{labelize(o.sector)}</span>}
                      </div>
                      <span className="lead" style={{ fontSize: 12 }}>
                        {o.sub_sector ? `${o.sub_sector} · ` : ''}{o.employee_count_range ? `${o.employee_count_range} employees` : ''}
                        {o.country ? ` · ${o.country}` : ''}
                      </span>
                      <span className="lead" style={{ fontSize: 11 }}>{o.email}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={deactivatingOrg[o.user_id]}
                      onClick={() => handleToggleOrg(o)}
                      style={o.is_active ? { color: '#dc2626' } : undefined}
                    >
                      {deactivatingOrg[o.user_id] ? '…' : o.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'verifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
            <div className="row gap-8">
              {['pending', 'approved', 'rejected', 'all'].map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${vFilter === f ? 'btn-acc' : 'btn-ghost'}`}
                  onClick={() => { setVFilter(f); loadVerifications(f) }}
                >
                  {labelize(f)}
                </button>
              ))}
            </div>

            {verifsLoading ? (
              <p className="lead">Loading…</p>
            ) : verifications.length === 0 ? (
              <p className="lead">No verifications found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {verifications.map((v) => {
                  const notes = vNotes[v.verification_id] || {}
                  const inFlight = deciding[v.verification_id]
                  return (
                    <div key={v.verification_id} className="card">
                      <div className="row gap-8" style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{v.user_email}</span>
                        <span className="badge" style={{ background: ROLE_COLOR[v.user_role], color: '#fff', borderColor: ROLE_COLOR[v.user_role] }}>
                          {v.user_role}
                        </span>
                        <span
                          className={`badge ${v.status === 'pending' ? 'pending' : ''}`}
                          style={v.status === 'rejected' ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : undefined}
                        >
                          {v.status}
                        </span>
                      </div>

                      <div className="row gap-8 wrap" style={{ marginBottom: 8 }}>
                        <span className="tag">{labelize(v.verification_type)}</span>
                        {v.credential_name && <span className="tag">{v.credential_name}</span>}
                        <span className="lead" style={{ fontSize: 12 }}>
                          Submitted {new Date(v.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {v.verification_type === 'professional_credential' && (
                        <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <p className="lead" style={{ fontSize: 12 }}>
                            {v.institution && <>Institution: {v.institution}</>}
                            {v.year_obtained && <> · Obtained {v.year_obtained}</>}
                            {v.expiry_date && <> · Expires {new Date(v.expiry_date).toLocaleDateString()}</>}
                          </p>
                          <div className="row gap-8 wrap">
                            {v.credential_verification_url && (
                              <a href={v.credential_verification_url} target="_blank" rel="noreferrer" className="tag">
                                Credential link ↗
                              </a>
                            )}
                            {(v.submitted_document_urls || []).map((url, i) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="tag">
                                Document {i + 1} ↗
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.status === 'approved' && v.admin_notes && (
                        <p className="lead" style={{ fontSize: 12, marginTop: 4 }}>{v.admin_notes}</p>
                      )}
                      {v.status === 'rejected' && v.rejection_reason && (
                        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{v.rejection_reason}</p>
                      )}

                      {v.verification_type === 'professional_credential' && (
                        <div style={{ marginTop: 10 }}>
                          {v.ai_reviewed_at && (
                            <div className="card" style={{ padding: 14, background: 'var(--bg)', marginBottom: 8 }}>
                              <div className="row gap-8" style={{ marginBottom: 6 }}>
                                <span className="badge" style={AI_RECOMMENDATION_STYLE[v.ai_recommendation]}>
                                  AI: {labelize(v.ai_recommendation)}
                                </span>
                                <span className="tag">Confidence: {labelize(v.ai_confidence)}</span>
                              </div>
                              <p className="lead" style={{ fontSize: 12 }}>{v.ai_reasoning}</p>
                              {(v.ai_red_flags || []).length > 0 && (
                                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: '#dc2626' }}>
                                  {v.ai_red_flags.map((flag) => <li key={flag}>{flag}</li>)}
                                </ul>
                              )}
                              <p className="lead" style={{ fontSize: 10.5, marginTop: 6, fontStyle: 'italic' }}>
                                Advisory only — not an authoritative verification. You still decide below.
                              </p>
                            </div>
                          )}
                          {v.status === 'pending' && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={aiReviewing[v.verification_id]}
                                onClick={() => handleAIReview(v.verification_id)}
                              >
                                {aiReviewing[v.verification_id] ? 'Asking Gemini…' : v.ai_reviewed_at ? 'Re-review with AI' : 'Ask AI to Review'}
                              </button>
                              {aiReviewError[v.verification_id] && (
                                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{aiReviewError[v.verification_id]}</p>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {v.status === 'pending' && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div className="row gap-10">
                            <div className="field-group" style={{ flex: 1 }}>
                              <label className="field-label">Admin notes (optional)</label>
                              <input
                                className="field-input"
                                value={notes.admin_notes || ''}
                                disabled={inFlight}
                                onChange={(e) => setVNote(v.verification_id, 'admin_notes', e.target.value)}
                              />
                            </div>
                            <div className="field-group" style={{ flex: 1 }}>
                              <label className="field-label">Rejection reason (if rejecting)</label>
                              <input
                                className="field-input"
                                value={notes.rejection_reason || ''}
                                disabled={inFlight}
                                onChange={(e) => setVNote(v.verification_id, 'rejection_reason', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="row gap-8">
                            <button className="btn btn-acc btn-sm" disabled={inFlight} onClick={() => handleDecide(v.verification_id, 'approved')}>
                              {inFlight ? '…' : 'Approve'}
                            </button>
                            <button className="btn btn-ghost btn-sm" disabled={inFlight} style={{ color: '#dc2626' }} onClick={() => handleDecide(v.verification_id, 'rejected')}>
                              {inFlight ? '…' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
