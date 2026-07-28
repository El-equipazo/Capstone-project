import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { labelize, AVAILABILITY_LABEL } from '../utils/format'

const AI_REVIEW_ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI review isn’t set up on this server yet. Ask an admin to configure it.',
  AI_UNAVAILABLE: 'The AI review service is temporarily unavailable. Please try again in a moment.',
}

const PROFILE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'verified', label: 'Verified' },
]

const AVAILABILITY_STATUSES = ['available', 'limited', 'unavailable', 'booking_future']
const EMPLOYEE_COUNT_BUCKETS = ['<50', '50-250', '250-1k', '1k-10k', '>10k']
const VERIFICATION_TYPES = ['identity', 'professional_credential', 'organization_legitimacy', 'background_check']
const VERIFICATION_STATUS_FILTERS = ['pending', 'approved', 'rejected', 'all']

function initials(str) {
  const words = (str || '').replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function countBy(items, getKey, buckets) {
  const counts = Object.fromEntries(buckets.map((b) => [b, 0]))
  for (const item of items) {
    const key = getKey(item)
    if (key in counts) counts[key] += 1
  }
  return buckets.map((b) => ({ label: labelize(b), count: counts[b] }))
}

function CountsCard({ title, items }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <span className="section-label">{title}</span>
      <div className="row gap-10" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        {items.map((it) => (
          <div key={it.label} className="stat">
            <span className="v">{it.value}</span>
            <span className="l">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BreakdownCard({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="card" style={{ padding: 18 }}>
      <span className="section-label">{title}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {rows.map((r) => (
          <div key={r.label} className="row gap-10">
            <span style={{ fontSize: 12, width: 110, flex: 'none', color: 'var(--muted)' }}>{r.label}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--fill)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(r.count / max) * 100}%`,
                  height: '100%',
                  background: 'var(--acc)',
                  borderRadius: 4,
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, width: 20, textAlign: 'right' }}>{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('experts')
  const [error, setError] = useState('')

  const [experts, setExperts] = useState([])
  const [expertsLoading, setExpertsLoading] = useState(true)
  const [expertFilter, setExpertFilter] = useState('all')
  const [expertSearch, setExpertSearch] = useState('')
  const [verifyingExpert, setVerifyingExpert] = useState({})
  const [deactivatingExpert, setDeactivatingExpert] = useState({})

  const [orgs, setOrgs] = useState([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState('all')
  const [orgSearch, setOrgSearch] = useState('')
  const [deactivatingOrg, setDeactivatingOrg] = useState({})

  const [verifications, setVerifications] = useState([])
  const [verifsLoading, setVerifsLoading] = useState(true)
  const [vFilter, setVFilter] = useState('pending')
  const [vSearch, setVSearch] = useState('')
  const [expandedVerification, setExpandedVerification] = useState(null)
  const [deciding, setDeciding] = useState({})
  const [vNotes, setVNotes] = useState({})
  const [aiReviewing, setAiReviewing] = useState({})
  const [aiReviewError, setAiReviewError] = useState({})

  async function loadExperts() {
    setExpertsLoading(true)
    try {
      setExperts(await adminApi.listExpertProfiles({}))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setExpertsLoading(false)
    }
  }

  async function loadOrgs() {
    setOrgsLoading(true)
    try {
      setOrgs(await adminApi.listOrganizationProfiles({}))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setOrgsLoading(false)
    }
  }

  async function loadVerifications() {
    setVerifsLoading(true)
    try {
      setVerifications(await adminApi.listVerifications({}))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setVerifsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) { navigate('/login?next=/admin'); return }
    if (user.role !== 'admin') return
    loadExperts()
    loadOrgs()
    loadVerifications()
  }, [user, navigate])

  const filteredExperts = useMemo(() => {
    const q = expertSearch.trim().toLowerCase()
    return experts.filter((e) => {
      if (expertFilter === 'verified' && !e.is_verified) return false
      if (expertFilter === 'unverified' && e.is_verified) return false
      if (q && !`${e.first_name} ${e.last_name} ${e.email} ${e.headline ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [experts, expertFilter, expertSearch])

  const filteredOrgs = useMemo(() => {
    const q = orgSearch.trim().toLowerCase()
    return orgs.filter((o) => {
      if (orgFilter === 'verified' && !o.is_verified) return false
      if (orgFilter === 'unverified' && o.is_verified) return false
      if (q && !`${o.org_name} ${o.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [orgs, orgFilter, orgSearch])

  const filteredVerifications = useMemo(() => {
    const q = vSearch.trim().toLowerCase()
    return verifications.filter((v) => {
      if (vFilter !== 'all' && v.status !== vFilter) return false
      if (q && !`${v.user_email} ${v.credential_name ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [verifications, vFilter, vSearch])

  const pendingCount = useMemo(() => verifications.filter((v) => v.status === 'pending').length, [verifications])

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
      await loadVerifications()
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong.')
    } finally {
      setDeciding((p) => ({ ...p, [verificationId]: false }))
    }
  }

  async function handleAIReview(verificationId) {
    setExpandedVerification(verificationId)
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

  return (
    <div className="page">
      <div className="container">
        <span className="section-label" style={{ color: 'var(--acc)' }}>admin dashboard</span>
        <div className="row gap-10 wrap" style={{ margin: '10px 0 20px', alignItems: 'baseline' }}>
          <h1 className="h2">Platform Overview</h1>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <CountsCard
                title="Verification Status"
                items={[
                  { label: 'total', value: experts.length },
                  { label: 'verified', value: experts.filter((e) => e.is_verified).length },
                  { label: 'unverified', value: experts.filter((e) => !e.is_verified).length },
                  { label: 'deactivated', value: experts.filter((e) => !e.is_active).length },
                ]}
              />
              <BreakdownCard title="By Availability" rows={countBy(experts, (e) => e.availability_status, AVAILABILITY_STATUSES)} />
            </div>

            <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
              <div className="row gap-8">
                {PROFILE_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`btn btn-sm ${expertFilter === key ? 'btn-acc' : 'btn-ghost'}`}
                    onClick={() => setExpertFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="field-input"
                style={{ maxWidth: 260 }}
                placeholder="Search experts…"
                value={expertSearch}
                onChange={(e) => setExpertSearch(e.target.value)}
              />
            </div>

            {expertsLoading ? (
              <p className="lead">Loading…</p>
            ) : filteredExperts.length === 0 ? (
              <p className="lead">No experts match your filters.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Expert</th>
                      <th>Email</th>
                      <th>Headline</th>
                      <th>Availability</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExperts.map((e) => (
                      <tr key={e.expert_profile_id}>
                        <td>
                          <Link to={`/experts/${e.expert_profile_id}`} className="row gap-8" style={{ color: 'inherit', textDecoration: 'none' }}>
                            <span className="avatar avatar-sm">{initials(`${e.first_name} ${e.last_name}`)}</span>
                            <span style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</span>
                          </Link>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{e.email}</td>
                        <td style={{ color: 'var(--muted)' }}>{e.headline ?? '—'}</td>
                        <td>
                          <span className="tag">{AVAILABILITY_LABEL[e.availability_status] ?? e.availability_status}</span>
                        </td>
                        <td>
                          <div className="row gap-6 wrap">
                            <span className={`badge ${e.is_verified ? 'approved' : 'pending'}`}>
                              {e.is_verified ? '✓ Verified' : labelize(e.verification_status ?? 'unsubmitted')}
                            </span>
                            {!e.is_active && <span className="badge rejected">deactivated</span>}
                          </div>
                        </td>
                        <td>
                          <div className="row gap-8">
                            <button
                              className={`btn btn-sm ${e.is_verified ? 'btn-ghost' : 'btn-acc'}`}
                              disabled={verifyingExpert[e.expert_profile_id]}
                              onClick={() => handleToggleVerifyExpert(e)}
                              style={e.is_verified ? { color: 'var(--danger)' } : undefined}
                            >
                              {verifyingExpert[e.expert_profile_id] ? '…' : e.is_verified ? 'Unverify' : 'Verify'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={deactivatingExpert[e.user_id]}
                              onClick={() => handleToggleExpert(e)}
                              style={e.is_active ? { color: 'var(--danger)' } : undefined}
                            >
                              {deactivatingExpert[e.user_id] ? '…' : e.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'organizations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <CountsCard
                title="Verification Status"
                items={[
                  { label: 'total', value: orgs.length },
                  { label: 'verified', value: orgs.filter((o) => o.is_verified).length },
                  { label: 'unverified', value: orgs.filter((o) => !o.is_verified).length },
                  { label: 'deactivated', value: orgs.filter((o) => !o.is_active).length },
                ]}
              />
              <BreakdownCard title="By Company Size" rows={countBy(orgs, (o) => o.employee_count_range, EMPLOYEE_COUNT_BUCKETS)} />
            </div>

            <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
              <div className="row gap-8">
                {PROFILE_FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`btn btn-sm ${orgFilter === key ? 'btn-acc' : 'btn-ghost'}`}
                    onClick={() => setOrgFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="field-input"
                style={{ maxWidth: 260 }}
                placeholder="Search organizations…"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
              />
            </div>

            {orgsLoading ? (
              <p className="lead">Loading…</p>
            ) : filteredOrgs.length === 0 ? (
              <p className="lead">No organizations match your filters.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Email</th>
                      <th>Industry</th>
                      <th>Company size</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map((o) => (
                      <tr key={o.org_profile_id}>
                        <td>
                          <div className="row gap-8">
                            <span className="avatar avatar-sm">{initials(o.org_name)}</span>
                            <span style={{ fontWeight: 600 }}>{o.org_name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{o.email}</td>
                        <td style={{ color: 'var(--muted)' }}>{o.sub_sector || '—'}</td>
                        <td>{o.employee_count_range ? <span className="tag">{o.employee_count_range}</span> : '—'}</td>
                        <td>
                          <div className="row gap-6 wrap">
                            <span className={`badge ${o.is_verified ? 'approved' : 'pending'}`}>
                              {o.is_verified ? '✓ Verified' : 'Pending'}
                            </span>
                            {!o.is_active && <span className="badge rejected">deactivated</span>}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={deactivatingOrg[o.user_id]}
                            onClick={() => handleToggleOrg(o)}
                            style={o.is_active ? { color: 'var(--danger)' } : undefined}
                          >
                            {deactivatingOrg[o.user_id] ? '…' : o.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'verifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <CountsCard
                title="Approval Status"
                items={[
                  { label: 'requested', value: verifications.length },
                  { label: 'approved', value: verifications.filter((v) => v.status === 'approved').length },
                  { label: 'rejected', value: verifications.filter((v) => v.status === 'rejected').length },
                  { label: 'pending', value: pendingCount },
                ]}
              />
              <BreakdownCard title="By Type" rows={countBy(verifications, (v) => v.verification_type, VERIFICATION_TYPES)} />
            </div>

            <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
              <div className="row gap-8">
                {VERIFICATION_STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    className={`btn btn-sm ${vFilter === f ? 'btn-acc' : 'btn-ghost'}`}
                    onClick={() => setVFilter(f)}
                  >
                    {labelize(f)}
                  </button>
                ))}
              </div>
              <input
                className="field-input"
                style={{ maxWidth: 260 }}
                placeholder="Search verifications…"
                value={vSearch}
                onChange={(e) => setVSearch(e.target.value)}
              />
            </div>

            {verifsLoading ? (
              <p className="lead">Loading…</p>
            ) : filteredVerifications.length === 0 ? (
              <p className="lead">No verifications match your filters.</p>
            ) : (
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Type</th>
                      <th>Credential</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVerifications.map((v) => {
                      const notes = vNotes[v.verification_id] || {}
                      const inFlight = deciding[v.verification_id]
                      const isExpanded = expandedVerification === v.verification_id
                      const isCredential = v.verification_type === 'professional_credential'
                      return (
                        <Fragment key={v.verification_id}>
                          <tr>
                            <td>
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => setExpandedVerification(isExpanded ? null : v.verification_id)}
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? '▾' : '▸'}
                              </button>
                            </td>
                            <td>
                              <div className="row gap-8">
                                <span className="avatar avatar-sm">{initials(v.user_email)}</span>
                                <span style={{ fontWeight: 600 }}>{v.user_email}</span>
                              </div>
                            </td>
                            <td><span className={`badge role-${v.user_role}`}>{v.user_role}</span></td>
                            <td><span className="tag">{labelize(v.verification_type)}</span></td>
                            <td style={{ color: 'var(--muted)' }}>{v.credential_name ?? '—'}</td>
                            <td>
                              {v.status === 'pending' ? (
                                <span className="badge pending">pending</span>
                              ) : (
                                <span className={`badge ${v.status === 'approved' ? 'approved' : 'rejected'}`}>{v.status}</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--muted)' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                            <td>
                              {v.status === 'pending' ? (
                                <div className="row gap-6">
                                  <button
                                    className="btn btn-icon"
                                    style={{ background: 'var(--good)', color: '#fff' }}
                                    disabled={inFlight}
                                    title="Approve"
                                    onClick={() => handleDecide(v.verification_id, 'approved')}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    className="btn btn-icon"
                                    style={{ background: 'var(--danger)', color: '#fff' }}
                                    disabled={inFlight}
                                    title="Reject"
                                    onClick={() => handleDecide(v.verification_id, 'rejected')}
                                  >
                                    ✕
                                  </button>
                                  {isCredential && (
                                    <button
                                      className="btn btn-sm btn-acc"
                                      disabled={aiReviewing[v.verification_id]}
                                      title="Ask AI to review"
                                      onClick={() => handleAIReview(v.verification_id)}
                                    >
                                      {aiReviewing[v.verification_id] ? 'Reviewing…' : 'AI Review'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="lead" style={{ fontSize: 11 }}>Decided</span>
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="expanded-detail">
                              <td colSpan={8} style={{ background: 'var(--bg)' }}>
                                <div style={{ padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {isCredential && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                                    <p className="lead" style={{ fontSize: 12 }}>{v.admin_notes}</p>
                                  )}
                                  {v.status === 'rejected' && v.rejection_reason && (
                                    <p style={{ fontSize: 12, color: 'var(--danger)' }}>{v.rejection_reason}</p>
                                  )}

                                  {isCredential && (
                                    <div>
                                      {v.ai_reviewed_at && (
                                        <div className="card" style={{ padding: 14, marginBottom: 8 }}>
                                          <div className="row gap-8" style={{ marginBottom: 6 }}>
                                            <span className={`badge ai-${v.ai_recommendation}`}>
                                              AI: {labelize(v.ai_recommendation)}
                                            </span>
                                            <span className="tag">Confidence: {labelize(v.ai_confidence)}</span>
                                          </div>
                                          <p className="lead" style={{ fontSize: 12 }}>{v.ai_reasoning}</p>
                                          {(v.ai_red_flags || []).length > 0 && (
                                            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--danger)' }}>
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
                                            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{aiReviewError[v.verification_id]}</p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {v.status === 'pending' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                                        <button className="btn btn-ghost btn-sm" disabled={inFlight} style={{ color: 'var(--danger)' }} onClick={() => handleDecide(v.verification_id, 'rejected')}>
                                          {inFlight ? '…' : 'Reject'}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
