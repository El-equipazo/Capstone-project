import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, connectionsApi, engagementsApi, expertsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import ExpertCard from '../components/ExpertCard'
import { SPECIALIZATIONS, PROFICIENCY_LEVELS, ENGAGEMENT_LENGTHS } from '../data/mockExperts'
import { AVAILABILITY_LABEL, labelize, toNumberOrNull } from '../utils/format'

const AVAILABILITY_OPTIONS = Object.keys(AVAILABILITY_LABEL)

const BLANK_FORM = {
  first_name: '',
  last_name: '',
  headline: '',
  bio: '',
  years_of_experience: '',
  hourly_rate_min: '',
  hourly_rate_max: '',
  availability_status: 'available',
  preferred_engagement_length: 'both',
  linkedin_url: '',
}

function profileToForm(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    headline: profile.headline,
    bio: profile.bio,
    years_of_experience: String(profile.years_of_experience ?? ''),
    hourly_rate_min: String(profile.hourly_rate_min ?? ''),
    hourly_rate_max: String(profile.hourly_rate_max ?? ''),
    availability_status: profile.availability_status,
    preferred_engagement_length: profile.preferred_engagement_length,
    linkedin_url: profile.linkedin_url,
  }
}

export default function ExpertDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  const [connections, setConnections] = useState([])
  const [engagements, setEngagements] = useState([])
  const [respondingId, setRespondingId] = useState(null)

  const [specForm, setSpecForm] = useState({
    specialization: SPECIALIZATIONS[0],
    proficiency_level: PROFICIENCY_LEVELS[0],
    years_in_specialization: '',
  })

  useEffect(() => {
    if (!user) {
      navigate('/login?next=/dashboard')
      return
    }
    if (user.role !== 'expert') return
    authApi.me().then(({ profile: result }) => {
      setProfile(result)
      if (result) setForm(profileToForm(result))
      setLoading(false)
    })
  }, [user, navigate])

  // Only depends on the id (not the whole profile) so saving edits doesn't re-fetch these.
  const expertId = profile?.expert_profile_id
  useEffect(() => {
    if (!expertId) return
    Promise.all([connectionsApi.listForExpert(), engagementsApi.listForExpert()]).then(([conns, engs]) => {
      setConnections(conns)
      setEngagements(engs)
    })
  }, [expertId])

  if (!user) return null

  if (user.role !== 'expert') {
    return (
      <div className="page">
        <div className="container empty-state">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>This dashboard is for expert accounts</p>
          <p className="lead" style={{ fontSize: 12.5, marginBottom: 16 }}>
            You're signed in as {user.role === 'organization' ? 'an organization' : 'an admin'}.
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

  function updateField(key, value) {
    setSavedNotice(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await expertsApi.createProfile(user.user_id, {
        ...form,
        years_of_experience: toNumberOrNull(form.years_of_experience),
        hourly_rate_min: toNumberOrNull(form.hourly_rate_min),
        hourly_rate_max: toNumberOrNull(form.hourly_rate_max),
      })
      setProfile(result)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await expertsApi.updateProfile(profile.expert_profile_id, {
        ...form,
        years_of_experience: toNumberOrNull(form.years_of_experience),
        hourly_rate_min: toNumberOrNull(form.hourly_rate_min),
        hourly_rate_max: toNumberOrNull(form.hourly_rate_max),
      })
      setProfile(result)
      setSavedNotice(true)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSpecialization(e) {
    e.preventDefault()
    if (profile.specializations.some((s) => s.specialization === specForm.specialization)) {
      setError('That specialization is already on your profile.')
      return
    }
    setError('')
    try {
      const item = await expertsApi.addSpecialization(profile.expert_profile_id, {
        ...specForm,
        years_in_specialization: toNumberOrNull(specForm.years_in_specialization),
      })
      setProfile((prev) => ({ ...prev, specializations: [...prev.specializations, item] }))
      setSpecForm({ specialization: SPECIALIZATIONS[0], proficiency_level: PROFICIENCY_LEVELS[0], years_in_specialization: '' })
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not add that specialization. Please try again.')
    }
  }

  async function handleRemoveSpecialization(specializationId) {
    setError('')
    try {
      await expertsApi.removeSpecialization(profile.expert_profile_id, specializationId)
      setProfile((prev) => ({
        ...prev,
        specializations: prev.specializations.filter((s) => s.specialization_id !== specializationId),
      }))
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not remove that specialization. Please try again.')
    }
  }

  async function handleRespond(connectionId, status) {
    setRespondingId(connectionId)
    setError('')
    try {
      const connection = connections.find((c) => c.connection_id === connectionId)
      await connectionsApi.respond(connectionId, status)

      // Accepting used to silently auto-create an engagement server-side;
      // that's now an explicit step (POST /engagements) so the org/expert
      // side can supply real budget/dates later without colliding with a
      // hidden duplicate. Fire it here so the demo experience (accept ->
      // engagement appears) stays the same.
      if (status === 'accepted' && connection) {
        const engagementType = connection.org_stated_need || 'risk_assessment'
        await engagementsApi.create({
          connection_id: connectionId,
          engagement_type: engagementType,
          title: `${labelize(engagementType)} — ${connection.org_name}`,
        })
      }

      const [conns, engs] = await Promise.all([connectionsApi.listForExpert(), engagementsApi.listForExpert()])
      setConnections(conns)
      setEngagements(engs)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not update this request. Please try again.')
    } finally {
      setRespondingId(null)
    }
  }

  // ---------------- No profile yet: creation form ----------------

  if (!profile) {
    const previewExpert = {
      expert_profile_id: 0,
      first_name: form.first_name || 'Your',
      last_name: form.last_name || 'Name',
      headline: form.headline || 'Your headline will appear here',
      years_of_experience: toNumberOrNull(form.years_of_experience) ?? 0,
      hourly_rate_min: toNumberOrNull(form.hourly_rate_min),
      hourly_rate_max: toNumberOrNull(form.hourly_rate_max),
      availability_status: form.availability_status,
      is_verified: false,
      avg_rating: null,
      total_completed_engagements: 0,
      specializations: [],
    }

    return (
      <div className="page">
        <div className="container">
          <span className="section-label" style={{ color: 'var(--acc)' }}>
            expert dashboard
          </span>
          <h1 className="h2" style={{ margin: '10px 0 6px' }}>
            Create your profile
          </h1>
          <p className="lead" style={{ marginBottom: 22 }}>
            This is what organizations will see in the directory once it's verified.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
            <form onSubmit={handleCreate} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="row gap-10">
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">First name</label>
                  <input className="field-input" required value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Last name</label>
                  <input className="field-input" required value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Headline</label>
                <input
                  className="field-input"
                  placeholder="e.g. Post-Quantum Cryptography Specialist"
                  value={form.headline}
                  onChange={(e) => updateField('headline', e.target.value)}
                />
              </div>

              <div className="field-group">
                <label className="field-label">Bio</label>
                <textarea
                  className="field-input"
                  rows={4}
                  value={form.bio}
                  onChange={(e) => updateField('bio', e.target.value)}
                />
              </div>

              <div className="row gap-10">
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Years of experience</label>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={form.years_of_experience}
                    onChange={(e) => updateField('years_of_experience', e.target.value)}
                  />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Rate min ($/hr)</label>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={form.hourly_rate_min}
                    onChange={(e) => updateField('hourly_rate_min', e.target.value)}
                  />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Rate max ($/hr)</label>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={form.hourly_rate_max}
                    onChange={(e) => updateField('hourly_rate_max', e.target.value)}
                  />
                </div>
              </div>

              <div className="row gap-10">
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Availability</label>
                  <select
                    className="field-input"
                    value={form.availability_status}
                    onChange={(e) => updateField('availability_status', e.target.value)}
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {AVAILABILITY_LABEL[o]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label className="field-label">Preferred engagement length</label>
                  <select
                    className="field-input"
                    value={form.preferred_engagement_length}
                    onChange={(e) => updateField('preferred_engagement_length', e.target.value)}
                  >
                    {ENGAGEMENT_LENGTHS.map((o) => (
                      <option key={o} value={o}>
                        {labelize(o)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">LinkedIn URL</label>
                <input
                  className="field-input"
                  placeholder="https://linkedin.com/in/…"
                  value={form.linkedin_url}
                  onChange={(e) => updateField('linkedin_url', e.target.value)}
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button className="btn btn-acc btn-block" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create profile'}
              </button>
            </form>

            <aside style={{ position: 'sticky', top: 84, alignSelf: 'flex-start' }}>
              <span className="section-label" style={{ marginBottom: 12, display: 'block' }}>
                Live preview · buyer view
              </span>
              <ExpertCard expert={previewExpert} />
            </aside>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- Profile exists: Overview / Profile tabs ----------------

  const pendingRequests = connections.filter((c) => c.status === 'pending')
  const respondedRequests = connections.filter((c) => c.status !== 'pending')
  const activeEngagements = engagements.filter((e) => e.status !== 'completed' && e.status !== 'cancelled')

  const draftExpert = {
    ...profile,
    first_name: form.first_name,
    last_name: form.last_name,
    headline: form.headline,
    bio: form.bio,
    years_of_experience: toNumberOrNull(form.years_of_experience) ?? 0,
    hourly_rate_min: toNumberOrNull(form.hourly_rate_min),
    hourly_rate_max: toNumberOrNull(form.hourly_rate_max),
    availability_status: form.availability_status,
    preferred_engagement_length: form.preferred_engagement_length,
    linkedin_url: form.linkedin_url,
  }

  return (
    <div className="page">
      <div className="container">
        <span className="section-label" style={{ color: 'var(--acc)' }}>
          expert dashboard
        </span>
        <div className="row gap-10 wrap" style={{ justifyContent: 'space-between', margin: '10px 0 18px' }}>
          <h1 className="h2">{profile.first_name} {profile.last_name}</h1>
          <Link to={`/experts/${profile.expert_profile_id}`} className="btn btn-sm">
            View public profile
          </Link>
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${tab === 'overview' ? 'on' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button className={`dash-tab ${tab === 'profile' ? 'on' : ''}`} onClick={() => setTab('profile')}>
            Profile
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: '16px 0' }}>
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{pendingRequests.length}</span>
                  <span className="l">pending requests</span>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{activeEngagements.length}</span>
                  <span className="l">active engagements</span>
                </div>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <div className="stat">
                  <span className="v">{profile.avg_rating ? profile.avg_rating.toFixed(1) : 'New'}</span>
                  <span className="l">rating</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <span className="section-label">Incoming requests</span>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pendingRequests.length === 0 && (
                  <p className="lead" style={{ fontSize: 12.5 }}>
                    No pending requests right now.
                  </p>
                )}
                {pendingRequests.map((c) => (
                  <div key={c.connection_id} className="dash-request-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row gap-8 wrap" style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{c.org_name}</span>
                        <span className="tag">{labelize(c.org_sector)}</span>
                        <span className="tag">{labelize(c.org_stated_need)}</span>
                        <span className="tag">Match {Math.round(c.match_score)}%</span>
                      </div>
                      <p className="lead" style={{ fontSize: 12.5, marginBottom: 6 }}>
                        {c.initial_message}
                      </p>
                      <span className="lead" style={{ fontSize: 11 }}>
                        Timeline: {labelize(c.org_stated_timeline)}
                      </span>
                    </div>
                    <div className="row gap-8" style={{ flex: 'none' }}>
                      <button
                        className="btn btn-sm"
                        disabled={respondingId === c.connection_id}
                        onClick={() => handleRespond(c.connection_id, 'declined')}
                      >
                        Decline
                      </button>
                      <button
                        className="btn btn-acc btn-sm"
                        disabled={respondingId === c.connection_id}
                        onClick={() => handleRespond(c.connection_id, 'accepted')}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <span className="section-label">Engagements</span>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {engagements.length === 0 && (
                  <p className="lead" style={{ fontSize: 12.5 }}>
                    No engagements yet — accept a request above to get started.
                  </p>
                )}
                {engagements.map((e) => (
                  <div key={e.engagement_id} className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</span>
                    <span className="tag">{labelize(e.status)}</span>
                  </div>
                ))}
              </div>
            </div>

            {respondedRequests.length > 0 && (
              <div className="card" style={{ padding: 22 }}>
                <span className="section-label">Past requests</span>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {respondedRequests.map((c) => (
                    <div key={c.connection_id} className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5 }}>{c.org_name}</span>
                      <span className="tag">{labelize(c.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <form onSubmit={handleSave} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span className="section-label">Profile</span>

                <div className="row gap-10">
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">First name</label>
                    <input className="field-input" required value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
                  </div>
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Last name</label>
                    <input className="field-input" required value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Headline</label>
                  <input className="field-input" value={form.headline} onChange={(e) => updateField('headline', e.target.value)} />
                </div>

                <div className="field-group">
                  <label className="field-label">Bio</label>
                  <textarea className="field-input" rows={4} value={form.bio} onChange={(e) => updateField('bio', e.target.value)} />
                </div>

                <div className="row gap-10">
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Years of experience</label>
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={form.years_of_experience}
                      onChange={(e) => updateField('years_of_experience', e.target.value)}
                    />
                  </div>
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Rate min ($/hr)</label>
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={form.hourly_rate_min}
                      onChange={(e) => updateField('hourly_rate_min', e.target.value)}
                    />
                  </div>
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Rate max ($/hr)</label>
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={form.hourly_rate_max}
                      onChange={(e) => updateField('hourly_rate_max', e.target.value)}
                    />
                  </div>
                </div>

                <div className="row gap-10">
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Availability</label>
                    <select
                      className="field-input"
                      value={form.availability_status}
                      onChange={(e) => updateField('availability_status', e.target.value)}
                    >
                      {AVAILABILITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {AVAILABILITY_LABEL[o]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group" style={{ flex: 1 }}>
                    <label className="field-label">Preferred engagement length</label>
                    <select
                      className="field-input"
                      value={form.preferred_engagement_length}
                      onChange={(e) => updateField('preferred_engagement_length', e.target.value)}
                    >
                      {ENGAGEMENT_LENGTHS.map((o) => (
                        <option key={o} value={o}>
                          {labelize(o)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">LinkedIn URL</label>
                  <input className="field-input" value={form.linkedin_url} onChange={(e) => updateField('linkedin_url', e.target.value)} />
                </div>

                {savedNotice && <div className="alert alert-success">Saved.</div>}

                <button className="btn btn-acc" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </form>

              <div className="card" style={{ padding: 22 }}>
                <span className="section-label">Specializations</span>
                <div className="row gap-8 wrap" style={{ marginTop: 14, marginBottom: 16 }}>
                  {profile.specializations.length === 0 && <p className="lead" style={{ fontSize: 12.5 }}>No specializations added yet.</p>}
                  {profile.specializations.map((s) => (
                    <span key={s.specialization_id} className="chip on">
                      {labelize(s.specialization)} <span className="tag" style={{ marginLeft: 4 }}>{labelize(s.proficiency_level)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialization(s.specialization_id)}
                        aria-label={`Remove ${labelize(s.specialization)}`}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', marginLeft: 4, fontSize: 13 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                <form onSubmit={handleAddSpecialization} className="row gap-8 wrap" style={{ alignItems: 'flex-end' }}>
                  <div className="field-group">
                    <label className="field-label">Specialization</label>
                    <select
                      className="field-input"
                      value={specForm.specialization}
                      onChange={(e) => setSpecForm((prev) => ({ ...prev, specialization: e.target.value }))}
                    >
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s}>
                          {labelize(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Proficiency</label>
                    <select
                      className="field-input"
                      value={specForm.proficiency_level}
                      onChange={(e) => setSpecForm((prev) => ({ ...prev, proficiency_level: e.target.value }))}
                    >
                      {PROFICIENCY_LEVELS.map((p) => (
                        <option key={p} value={p}>
                          {labelize(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group" style={{ width: 90 }}>
                    <label className="field-label">Years</label>
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={specForm.years_in_specialization}
                      onChange={(e) => setSpecForm((prev) => ({ ...prev, years_in_specialization: e.target.value }))}
                    />
                  </div>
                  <button className="btn btn-sm" type="submit">
                    Add
                  </button>
                </form>
              </div>
            </div>

            <aside style={{ position: 'sticky', top: 84, alignSelf: 'flex-start' }}>
              <span className="section-label" style={{ marginBottom: 12, display: 'block' }}>
                Live preview · buyer view
              </span>
              <ExpertCard expert={draftExpert} />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
