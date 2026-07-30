import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, organizationsApi, matchingApi, connectionsApi, expertsApi, engagementsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import OnboardingWizard from '../components/onboarding/OnboardingWizard'
import RecommendationCard from '../components/matching/RecommendationCard'
import TagInput from '../components/organization/TagInput'
import DeleteAccount from '../components/DeleteAccount'
import { labelize, BUDGET_RANGE_LABEL, toNumberOrNull } from '../utils/format'

const MATCH_ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI matching isn’t set up on this server yet. Ask an admin to configure it.',
  AI_UNAVAILABLE: 'The AI matching service is temporarily unavailable. Please try again in a moment.',
}

const EMPLOYEE_COUNT_OPTIONS = ['<50', '50-250', '250-1k', '1k-10k', '>10k']
const QUANTUM_KNOWLEDGE_OPTIONS = ['none', 'basic', 'intermediate', 'advanced']
const BUDGET_RANGE_OPTIONS = ['under_10k', '10k_50k', '50k_250k', '250k_plus', 'undisclosed']
const URGENCY_OPTIONS = ['just_exploring', 'planning_ahead', 'urgent', 'critical']
const STORAGE_TYPE_OPTIONS = ['on_premise', 'cloud', 'hybrid', 'legacy_mainframe', 'mixed']

const COMPLIANCE_SUGGESTIONS = [
  'BSA', 'AML', 'KYC', 'OFAC', 'FCPA', 'CFPB', 'TILA', 'FCRA', 'ECOA',
  'GLBA', 'PCI DSS', 'DORA', 'GDPR', 'SOX', 'CECL', 'FINRA', 'CFTC', 'FFIEC',
]
const ENCRYPTION_SUGGESTIONS = [
  'AES', 'AES-256', 'AES-128', 'AES-192', 'ChaCha20',
  'RSA', 'RSA-2048', 'RSA-4096',
  'ECC', 'ECDSA', 'EdDSA', 'ECDH',
  'ML-KEM (FIPS 203)', 'ML-DSA (FIPS 204)', 'SLH-DSA (FIPS 205)', 'FN-DSA (FIPS 206)',
  'TLS 1.3', 'SSHv2', 'SFTP',
]
const CLOUD_PROVIDER_SUGGESTIONS = ['AWS', 'Azure', 'GCP']
const DATA_CATEGORY_SUGGESTIONS = ['customer_pii', 'transaction_records', 'financial_records', 'health_records', 'employee_records']

function infraToForm(infra) {
  return {
    data_categories: infra?.data_categories || [],
    storage_type: infra?.storage_type || '',
    primary_cloud_providers: infra?.primary_cloud_providers || [],
    current_encryption_standards: infra?.current_encryption_standards || [],
    data_retention_years: infra?.data_retention_years ?? '',
    oldest_system_age_years: infra?.oldest_system_age_years ?? '',
    compliance_requirements: infra?.compliance_requirements || [],
    has_dedicated_security_team: infra?.has_dedicated_security_team || false,
    had_prior_quantum_assessment: infra?.had_prior_quantum_assessment || false,
    known_risks_freetext: infra?.known_risks_freetext || '',
  }
}

function profileToForm(profile) {
  return {
    org_name: profile.org_name,
    contact_name: profile.contact_name || '',
    contact_title: profile.contact_title || '',
    sub_sector: profile.sub_sector || '',
    employee_count_range: profile.employee_count_range || '<50',
    country: profile.country || '',
    website: profile.website || '',
    org_description: profile.org_description || '',
    quantum_knowledge_level: profile.quantum_knowledge_level || 'none',
    budget_range: profile.budget_range || 'undisclosed',
    urgency_level: profile.urgency_level || 'just_exploring',
  }
}

export default function OrganizationDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [connections, setConnections] = useState([])
  const [engagements, setEngagements] = useState([])
  const [expertsById, setExpertsById] = useState({})
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`qc_org_dismissed_${user?.user_id}`) || '[]')) }
    catch { return new Set() }
  })

  const [needDescription, setNeedDescription] = useState('')
  const [matching, setMatching] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [matchError, setMatchError] = useState('')

  const [infraForm, setInfraForm] = useState(infraToForm(null))
  const [infraSaving, setInfraSaving] = useState(false)
  const [infraSavedNotice, setInfraSavedNotice] = useState(false)
  const [infraError, setInfraError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/login?next=/organization')
      return
    }
    if (user.role !== 'organization') return
    authApi.me().then(({ profile: result }) => {
      setProfile(result)
      if (result) setForm(profileToForm(result))
      setLoading(false)
    })
  }, [user, navigate])

  useEffect(() => {
    if (!profile) return
    Promise.all([connectionsApi.listForOrg(), engagementsApi.list()]).then(([conns, engs]) => {
      setConnections(conns)
      setEngagements(engs)
      const uniqueExpertIds = [...new Set(conns.map((c) => c.expert_id))]
      Promise.all(uniqueExpertIds.map((id) => expertsApi.getById(id).catch(() => null))).then((experts) => {
        const byId = {}
        experts.forEach((e, i) => {
          if (e) byId[uniqueExpertIds[i]] = e
        })
        setExpertsById(byId)
      })
    })
  }, [profile])

  useEffect(() => {
    if (!profile) return
    // No infrastructure record yet -> 404; treat as "nothing filled in" rather than an error.
    organizationsApi
      .getInfrastructure(profile.org_profile_id)
      .then((infra) => setInfraForm(infraToForm(infra)))
      .catch(() => setInfraForm(infraToForm(null)))
  }, [profile])

  if (!user) return null

  if (user.role !== 'organization') {
    return (
      <div className="page">
        <div className="container empty-state">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>This dashboard is for organization accounts</p>
          <p className="lead" style={{ fontSize: 12.5, marginBottom: 16 }}>
            You're signed in as {user.role === 'expert' ? 'an expert' : 'an admin'}.
          </p>
          <Link to="/experts" className="btn btn-sm">
            Browse the expert directory instead
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <p className="lead">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  async function handleOnboardingComplete({ invite_emails, ...wizardData }) {
    setError('')
    try {
      // invite_emails is decorative only (see OnboardingWizard) — there's no
      // team/invite concept in organization_profiles to send it to.
      const result = await organizationsApi.createProfile(user.user_id, {
        ...wizardData,
        sector: 'financial', // the whole platform is scoped to financial institutions
      })
      setProfile(result)
      setForm(profileToForm(result))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    }
  }

  // ---------------- No profile yet: onboarding wizard ----------------

  if (!profile) {
    return (
      <div className="page">
        <div className="container">
          <span className="section-label" style={{ color: 'var(--acc)' }}>
            organization onboarding
          </span>
          <h1 className="h2" style={{ margin: '10px 0 6px' }}>
            Welcome to Lattice
          </h1>
          <p className="lead" style={{ marginBottom: 22 }}>
            A few quick steps to set up your organization's profile.
          </p>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
              {error}
            </div>
          )}
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        </div>
      </div>
    )
  }

  // ---------------- Profile exists: Overview / Profile tabs ----------------

  function updateField(key, value) {
    setSavedNotice(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await organizationsApi.updateProfile(profile.org_profile_id, form)
      setProfile(result)
      setForm(profileToForm(result))
      setSavedNotice(true)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMatch(e) {
    e.preventDefault()
    setMatchError('')
    setMatching(true)
    try {
      const result = await matchingApi.getRecommendations({
        need_description: needDescription.trim() || undefined,
        limit: 5,
      })
      setRecommendations(result.recommendations)
    } catch (err) {
      const code = err.body?.error?.code
      setMatchError(MATCH_ERROR_MESSAGES[code] ?? err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setMatching(false)
    }
  }

  function updateInfraField(key, value) {
    setInfraSavedNotice(false)
    setInfraForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSaveInfrastructure(e) {
    e.preventDefault()
    setInfraError('')
    setInfraSaving(true)
    try {
      const result = await organizationsApi.upsertInfrastructure(profile.org_profile_id, {
        ...infraForm,
        storage_type: infraForm.storage_type || undefined,
        data_retention_years: toNumberOrNull(infraForm.data_retention_years),
        oldest_system_age_years: toNumberOrNull(infraForm.oldest_system_age_years),
      })
      setInfraForm(infraToForm(result))
      setInfraSavedNotice(true)
    } catch (err) {
      setInfraError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setInfraSaving(false)
    }
  }

  const TERMINAL = ['completed', 'cancelled']
  const activeEngagements = engagements.filter((e) => !TERMINAL.includes(e.status))

  const _pastConnections = connections
    .filter((c) => ['declined', 'expired'].includes(c.status))
    .map((c) => ({ id: `conn-${c.connection_id}`, label: `Expert #${c.expert_id}`, status: c.status, link: `/experts/${c.expert_id}` }))
  const _pastEngagements = engagements
    .filter((e) => TERMINAL.includes(e.status))
    .map((e) => ({ id: `eng-${e.engagement_id}`, label: e.title || labelize(e.engagement_type), status: e.status, link: `/engagements/${e.engagement_id}` }))
  const allPastItems = [..._pastConnections, ..._pastEngagements]

  const DISMISSED_KEY = `qc_org_dismissed_${user?.user_id}`

  function dismissItem(id) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function clearAllPast() {
    const ids = allPastItems.map((i) => i.id)
    setDismissed((prev) => {
      const next = new Set([...prev, ...ids])
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const pastItems = allPastItems.filter((i) => !dismissed.has(i.id))

  return (
    <div className="page">
      <div className="container">
        <span className="section-label" style={{ color: 'var(--acc)' }}>
          organization dashboard
        </span>
        <div className="row gap-10 wrap" style={{ margin: '10px 0 18px' }}>
          <h1 className="h2">{profile.org_name}</h1>
          <span className={`badge ${profile.is_verified ? '' : 'pending'}`}>
            {profile.is_verified ? '✓ Verified' : 'Pending verification'}
          </span>
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${tab === 'overview' ? 'on' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={`dash-tab ${tab === 'profile' ? 'on' : ''}`} onClick={() => setTab('profile')}>
            Profile
          </button>
          <button className={`dash-tab ${tab === 'infrastructure' ? 'on' : ''}`} onClick={() => setTab('infrastructure')}>
            Infrastructure
          </button>
          <button className={`dash-tab ${tab === 'match' ? 'on' : ''}`} onClick={() => setTab('match')}>
            AI Match
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: '16px 0' }}>
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{labelize(profile.urgency_level)}</span>
                  <span className="l">urgency</span>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{BUDGET_RANGE_LABEL[profile.budget_range]}</span>
                  <span className="l">budget range</span>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{labelize(profile.quantum_knowledge_level)}</span>
                  <span className="l">quantum knowledge</span>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{profile.employee_count_range}</span>
                  <span className="l">employees</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <span className="section-label">Company snapshot</span>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p className="lead" style={{ fontSize: 13 }}>
                  {profile.org_description || 'No company description yet — add one from the Profile tab.'}
                </p>
                <div className="row gap-8 wrap">
                  <span className="tag">Financial services{profile.sub_sector ? ` · ${profile.sub_sector}` : ''}</span>
                  {profile.country && <span className="tag">{profile.country}</span>}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer" className="tag">
                      {profile.website} ↗
                    </a>
                  )}
                </div>
                {profile.contact_name && (
                  <span className="lead" style={{ fontSize: 12 }}>
                    Primary contact: {profile.contact_name}
                    {profile.contact_title ? ` · ${profile.contact_title}` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <span className="section-label">Engagements</span>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeEngagements.length === 0 ? (
                  <p className="lead" style={{ fontSize: 12.5 }}>
                    No active engagements.{' '}
                    <Link to="/experts" style={{ color: 'var(--acc)' }}>Browse the expert directory</Link>{' '}
                    to send a connection request.
                  </p>
                ) : activeEngagements.map((e) => (
                  <Link
                    key={e.engagement_id}
                    to={`/engagements/${e.engagement_id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    <div className="row gap-8 wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{e.title || labelize(e.engagement_type)}</span>
                        {e.expert_first_name && (
                          <span className="lead" style={{ fontSize: 12, marginLeft: 6 }}>
                            with {e.expert_first_name} {e.expert_last_name}
                          </span>
                        )}
                      </div>
                      <span className={e.status === 'active' ? 'badge' : 'tag'}>{labelize(e.status)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {pastItems.length > 0 && (
              <div className="card" style={{ padding: 22 }}>
                <div className="row gap-8" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
                  <span className="section-label">Past requests &amp; engagements</span>
                  <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={clearAllPast}>
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pastItems.map((item) => (
                    <div key={item.id} className="row gap-8 wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="row gap-8 wrap" style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                        {item.link ? (
                          <Link to={item.link} style={{ fontWeight: 500, fontSize: 12.5, color: 'inherit' }}>
                            {item.label}
                          </Link>
                        ) : (
                          <span style={{ fontSize: 12.5 }}>{item.label}</span>
                        )}
                        <span className="tag" style={{ fontSize: 11 }}>{labelize(item.status)}</span>
                      </div>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => dismissItem(item.id)}
                        title="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {connections.filter((c) => c.status === 'pending').length > 0 && (
              <div className="card" style={{ padding: 22 }}>
                <span className="section-label">Pending connection requests</span>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {connections.filter((c) => c.status === 'pending').map((c) => {
                    const expert = expertsById[c.expert_id]
                    return (
                      <div key={c.connection_id} className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            <Link to={`/experts/${c.expert_id}`} style={{ color: 'inherit' }}>
                              {expert ? `${expert.first_name} ${expert.last_name}` : `Expert #${c.expert_id}`}
                            </Link>
                          </span>
                          {c.org_stated_need && (
                            <span className="tag" style={{ marginLeft: 8, fontSize: 11 }}>{labelize(c.org_stated_need)}</span>
                          )}
                          {c.ai_fit_score != null && (
                            <span className="tag" style={{ marginLeft: 8, fontSize: 11 }} title={c.ai_reasoning || undefined}>
                              AI fit {c.ai_fit_score}%
                            </span>
                          )}
                        </div>
                        <span className="tag">{labelize(c.status)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <>
          <form onSubmit={handleSave} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <span className="section-label">Profile</span>

            <div className="row gap-10">
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Company name</label>
                <input className="field-input" required value={form.org_name} onChange={(e) => updateField('org_name', e.target.value)} />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Industry</label>
                <input
                  className="field-input"
                  value={form.sub_sector}
                  onChange={(e) => updateField('sub_sector', e.target.value)}
                  placeholder="e.g. Retail banking, Payments"
                />
              </div>
            </div>

            <div className="row gap-10">
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Contact name</label>
                <input className="field-input" value={form.contact_name} onChange={(e) => updateField('contact_name', e.target.value)} />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Contact role</label>
                <input className="field-input" value={form.contact_title} onChange={(e) => updateField('contact_title', e.target.value)} />
              </div>
            </div>

            <div className="row gap-10">
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Company size</label>
                <select className="field-input" value={form.employee_count_range} onChange={(e) => updateField('employee_count_range', e.target.value)}>
                  {EMPLOYEE_COUNT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o} employees
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Country</label>
                <input className="field-input" value={form.country} onChange={(e) => updateField('country', e.target.value)} />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Website</label>
              <input
                className="field-input"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="field-group">
              <label className="field-label">Company description</label>
              <textarea className="field-input" rows={3} value={form.org_description} onChange={(e) => updateField('org_description', e.target.value)} />
            </div>

            <div className="row gap-10">
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Quantum knowledge level</label>
                <select
                  className="field-input"
                  value={form.quantum_knowledge_level}
                  onChange={(e) => updateField('quantum_knowledge_level', e.target.value)}
                >
                  {QUANTUM_KNOWLEDGE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Budget range</label>
                <select className="field-input" value={form.budget_range} onChange={(e) => updateField('budget_range', e.target.value)}>
                  {BUDGET_RANGE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {BUDGET_RANGE_LABEL[o]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Urgency</label>
                <select className="field-input" value={form.urgency_level} onChange={(e) => updateField('urgency_level', e.target.value)}>
                  {URGENCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {labelize(o)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {savedNotice && <div className="alert alert-success">Saved.</div>}

            <button className="btn btn-acc" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>

          <div className="card" style={{ padding: 22, maxWidth: 640, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-label">Danger zone</span>
            <p className="lead" style={{ fontSize: 12.5 }}>
              Deleting your account deactivates it immediately and signs you out. This cannot be undone.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete account
            </button>
          </div>

          {showDeleteModal && (
            <DeleteAccount
              orgName={profile.org_name}
              onClose={() => setShowDeleteModal(false)}
              onDeleted={() => {
                logout()
                navigate('/')
              }}
            />
          )}
          </>
        )}

        {tab === 'infrastructure' && (
          <form
            onSubmit={handleSaveInfrastructure}
            className="card"
            style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}
          >
            <span className="section-label">Infrastructure</span>
            <p className="lead" style={{ fontSize: 12.5 }}>
              This isn't public — only you, admins, and experts you've accepted a connection with can see it.
              Filling it in improves how well we can match you with the right expert.
            </p>

            <TagInput
              label="Data categories you store"
              values={infraForm.data_categories}
              onChange={(v) => updateInfraField('data_categories', v)}
              suggestions={DATA_CATEGORY_SUGGESTIONS}
              restrictToSuggestions
            />

            <div className="field-group">
              <label className="field-label">Storage type</label>
              <select
                className="field-input"
                value={infraForm.storage_type}
                onChange={(e) => updateInfraField('storage_type', e.target.value)}
              >
                <option value="">Not set</option>
                {STORAGE_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {labelize(o)}
                  </option>
                ))}
              </select>
            </div>

            <TagInput
              label="Cloud providers"
              values={infraForm.primary_cloud_providers}
              onChange={(v) => updateInfraField('primary_cloud_providers', v)}
              suggestions={CLOUD_PROVIDER_SUGGESTIONS}
              restrictToSuggestions
            />

            <TagInput
              label="Current encryption standards"
              values={infraForm.current_encryption_standards}
              onChange={(v) => updateInfraField('current_encryption_standards', v)}
              suggestions={ENCRYPTION_SUGGESTIONS}
              restrictToSuggestions
            />

            <div className="row gap-10">
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Data retention (years)</label>
                <input
                  type="number"
                  min="0"
                  className="field-input"
                  value={infraForm.data_retention_years}
                  onChange={(e) => updateInfraField('data_retention_years', e.target.value)}
                />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">Oldest system age (years)</label>
                <input
                  type="number"
                  min="0"
                  className="field-input"
                  value={infraForm.oldest_system_age_years}
                  onChange={(e) => updateInfraField('oldest_system_age_years', e.target.value)}
                />
              </div>
            </div>

            <TagInput
              label="Compliance requirements"
              values={infraForm.compliance_requirements}
              onChange={(v) => updateInfraField('compliance_requirements', v)}
              suggestions={COMPLIANCE_SUGGESTIONS}
              restrictToSuggestions
            />

            <div className="row gap-16">
              <label className="row gap-8" style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={infraForm.has_dedicated_security_team}
                  onChange={(e) => updateInfraField('has_dedicated_security_team', e.target.checked)}
                />
                Dedicated security team
              </label>
              <label className="row gap-8" style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={infraForm.had_prior_quantum_assessment}
                  onChange={(e) => updateInfraField('had_prior_quantum_assessment', e.target.checked)}
                />
                Had a prior quantum-readiness assessment
              </label>
            </div>

            <div className="field-group">
              <label className="field-label">Known risks (optional)</label>
              <textarea
                className="field-input"
                rows={3}
                value={infraForm.known_risks_freetext}
                onChange={(e) => updateInfraField('known_risks_freetext', e.target.value)}
                placeholder="e.g. Legacy mainframe payment rails on RSA-2048."
              />
            </div>

            {infraError && <div className="alert alert-error">{infraError}</div>}
            {infraSavedNotice && <div className="alert alert-success">Saved.</div>}

            <button className="btn btn-acc" type="submit" disabled={infraSaving} style={{ alignSelf: 'flex-start' }}>
              {infraSaving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        {tab === 'match' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <form onSubmit={handleMatch} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span className="section-label">AI Match</span>
              <p className="lead" style={{ fontSize: 13 }}>
                Let Gemini rank our verified expert directory against your profile. Optionally describe what
                you're looking for to get a sharper match.
              </p>
              <div className="field-group">
                <label className="field-label">What do you need help with? (optional)</label>
                <textarea
                  className="field-input"
                  rows={3}
                  maxLength={2000}
                  value={needDescription}
                  onChange={(e) => setNeedDescription(e.target.value)}
                  placeholder="e.g. We need an independent audit of our payment rails before our next regulator exam."
                />
              </div>

              {matchError && <div className="alert alert-error">{matchError}</div>}

              <button className="btn btn-acc" type="submit" disabled={matching} style={{ alignSelf: 'flex-start' }}>
                {matching ? 'Finding matches…' : 'Find Matches'}
              </button>
            </form>

            {recommendations && recommendations.length === 0 && (
              <div className="empty-state card">
                <p style={{ fontWeight: 600, marginBottom: 8 }}>No matches found</p>
                <p className="lead" style={{ fontSize: 12.5 }}>Try adjusting your description and searching again.</p>
              </div>
            )}

            {recommendations && recommendations.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {recommendations.map((rec) => (
                  <RecommendationCard key={rec.expert_profile_id} recommendation={rec} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
