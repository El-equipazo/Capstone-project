import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, connectionsApi, engagementsApi, expertsApi, verificationsApi, uploadsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useChat_context } from '../context/ChatContext'
import ExpertCard from '../components/ExpertCard'
import MilestoneMap from '../components/MilestoneMap'
import RatingStars from '../components/RatingStars'
import ChangePasswordCard from '../components/ChangePasswordCard'
import TagInput from '../components/organization/TagInput'
import { SPECIALIZATIONS, PROFICIENCY_LEVELS, ENGAGEMENT_LENGTHS } from '../data/mockExperts'
import { AVAILABILITY_LABEL, BUDGET_RANGE_LABEL, ENGAGEMENT_TYPE_OPTIONS, labelize, toNumberOrNull } from '../utils/format'

const AVAILABILITY_OPTIONS = Object.keys(AVAILABILITY_LABEL)

// Engagement dates can't be set before today (server enforces this too).
const todayStr = new Date().toISOString().slice(0, 10)

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
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openChat } = useChat_context()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'overview')

  useEffect(() => {
    const t = searchParams.get('tab')
    setTab(t || 'overview')
    // Handle notification deep-links: ?open_thread=X (new) or ?tab=messages&thread=X (legacy)
    const threadId = searchParams.get('open_thread') || searchParams.get('thread')
    if (threadId) {
      openChat(parseInt(threadId, 10), 'Conversation')
      navigate('/dashboard', { replace: true })
    }
  }, [searchParams, openChat, navigate])
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  const [connections, setConnections] = useState([])
  const [engagements, setEngagements] = useState([])
  const [respondingId, setRespondingId] = useState(null)
  const [proposingFor, setProposingFor] = useState(null) // connection_id awaiting timeline
  const [timelineForm, setTimelineForm] = useState({ engagement_type: '', start_date: '', estimated_end_date: '', description: '' })

  const [specForm, setSpecForm] = useState({
    specialization: SPECIALIZATIONS[0],
    proficiency_level: PROFICIENCY_LEVELS[0],
    years_in_specialization: '',
  })

  // Specializations picked before the profile exists yet (creation form only) --
  // posted one-by-one to POST /experts/{id}/specializations right after the
  // profile itself is created, since that endpoint requires an existing id.
  const [newSpecForm, setNewSpecForm] = useState({
    specialization: SPECIALIZATIONS[0],
    proficiency_level: PROFICIENCY_LEVELS[0],
    years_in_specialization: '',
  })
  const [pendingSpecs, setPendingSpecs] = useState([])

  function addPendingSpecialization(e) {
    e.preventDefault()
    if (pendingSpecs.some((s) => s.specialization === newSpecForm.specialization)) {
      setError('That specialization is already added.')
      return
    }
    setError('')
    setPendingSpecs((prev) => [...prev, newSpecForm])
    setNewSpecForm({ specialization: SPECIALIZATIONS[0], proficiency_level: PROFICIENCY_LEVELS[0], years_in_specialization: '' })
  }

  function removePendingSpecialization(specialization) {
    setPendingSpecs((prev) => prev.filter((s) => s.specialization !== specialization))
  }

  const [verifyPrompt, setVerifyPrompt] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const CREDENTIAL_TYPES = ['certification', 'degree', 'license', 'publication', 'award', 'other']
  const BLANK_CRED = { credential_type: 'certification', credential_name: '', institution: '', year_obtained: '' }
  const [credForm, setCredForm] = useState(BLANK_CRED)
  const [addingCred, setAddingCred] = useState(false)
  const [credError, setCredError] = useState('')
  const [verifyFormFor, setVerifyFormFor] = useState(null)
  const [verifyDocUrls, setVerifyDocUrls] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [verifications, setVerifications] = useState([])
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`qc_dismissed_${user?.user_id}`) || '[]')) }
    catch { return new Set() }
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
    Promise.all([connectionsApi.listForExpert(), engagementsApi.list()]).then(([conns, engs]) => {
      setConnections(conns)
      setEngagements(engs)
    })
    verificationsApi.list().then(setVerifications).catch(() => {})
  }, [expertId])

  // Most recent professional_credential verification for one credential, if any —
  // list_for_user() already orders by created_at DESC, so [0] is the latest
  // (a credential can be resubmitted after a rejection).
  function latestVerificationFor(credentialId) {
    return verifications.find(
      (v) => v.verification_type === 'professional_credential' && v.related_credential_id === credentialId
    )
  }

  // Single source of truth for a credential's verification state — the
  // `verification_status` field some code used to set client-side on the
  // credential object was never actually populated from the backend on
  // page load (list_credentials()/_full_profile() only return `is_verified`,
  // a plain boolean), so it was always undefined on a fresh load and the
  // "Request verification" button showed even for already-approved
  // credentials. Deriving it from the real verification_records fetch fixes
  // that for approved/pending/rejected alike.
  function credentialStatus(credentialId) {
    return latestVerificationFor(credentialId)?.status ?? null
  }

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
    if (!form.headline.trim() || !form.linkedin_url.trim()) {
      setError('Headline and LinkedIn URL are required.')
      return
    }
    if (pendingSpecs.length === 0) {
      setError('Add at least one specialization.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const result = await expertsApi.createProfile(user.user_id, {
        ...form,
        years_of_experience: toNumberOrNull(form.years_of_experience),
        hourly_rate_min: toNumberOrNull(form.hourly_rate_min),
        hourly_rate_max: toNumberOrNull(form.hourly_rate_max),
      })
      // The profile now exists server-side no matter what happens below --
      // always advance past the creation form so a specialization POST
      // failing (network blip, transient error) can't strand the user on a
      // form that looks like nothing happened. allSettled (rather than
      // stopping at the first rejection) also means one bad specialization
      // doesn't take out the rest of the batch.
      const outcomes = await Promise.allSettled(
        pendingSpecs.map((spec) =>
          expertsApi.addSpecialization(result.expert_profile_id, {
            ...spec,
            years_in_specialization: toNumberOrNull(spec.years_in_specialization),
          })
        )
      )
      const failed = outcomes
        .map((o, i) => (o.status === 'rejected' ? pendingSpecs[i] : null))
        .filter(Boolean)
      setProfile(result)
      setVerifyPrompt(true)
      if (failed.length > 0) {
        const names = failed.map((s) => labelize(s.specialization)).join(', ')
        setError(`Profile created, but couldn't add: ${names}. Add them from your Profile tab.`)
      }
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
    if (profile.specializations.length <= 1) {
      setError('Your profile must have at least one specialization — add another before removing this one.')
      return
    }
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

  async function handleRequestIdentityVerification() {
    setVerifying(true)
    setError('')
    try {
      await verificationsApi.submit({ verification_type: 'identity' })
      setVerifyPrompt(false)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not submit verification request. Please try again.')
      setVerifyPrompt(false)
    } finally {
      setVerifying(false)
    }
  }

  async function handleAddCredential(e) {
    e.preventDefault()
    setCredError('')
    setAddingCred(true)
    try {
      const result = await expertsApi.addCredential(profile.expert_profile_id, {
        ...credForm,
        year_obtained: toNumberOrNull(credForm.year_obtained),
      })
      setProfile((prev) => ({
        ...prev,
        credentials: [...(prev.credentials || []), result],
      }))
      setCredForm(BLANK_CRED)
    } catch (err) {
      setCredError(err.body?.error?.message ?? 'Could not add credential. Please try again.')
    } finally {
      setAddingCred(false)
    }
  }

  async function handleDeleteCredential(credentialId) {
    setCredError('')
    try {
      await expertsApi.deleteCredential(profile.expert_profile_id, credentialId)
      setProfile((prev) => ({
        ...prev,
        credentials: (prev.credentials || []).filter((c) => c.credential_id !== credentialId),
      }))
    } catch (err) {
      setCredError(err.body?.error?.message ?? 'Could not remove credential.')
    }
  }

  async function handleRequestCredentialVerification(credentialId, documentUrls) {
    setCredError('')
    setSubmittingVerification(true)
    try {
      await verificationsApi.submit({
        verification_type: 'professional_credential',
        related_credential_id: credentialId,
        submitted_document_urls: documentUrls.length ? documentUrls : undefined,
      })
      setVerifications(await verificationsApi.list())
      setVerifyFormFor(null)
      setVerifyDocUrls([])
    } catch (err) {
      setCredError(err.body?.error?.message ?? 'Could not submit verification request.')
    } finally {
      setSubmittingVerification(false)
    }
  }

  async function handleUploadDocument(file) {
    setUploadError('')
    setUploadingDoc(true)
    try {
      const { url } = await uploadsApi.upload(file)
      setVerifyDocUrls((prev) => [...prev, url])
    } catch (err) {
      setUploadError(err.body?.error?.message ?? 'Could not upload file. Please try again.')
    } finally {
      setUploadingDoc(false)
    }
  }

  // Saves immediately on upload (no separate "Save profile" click needed) --
  // matches how a photo/avatar control behaves in most products.
  async function handleUploadPhoto(file) {
    setPhotoError('')
    setUploadingPhoto(true)
    try {
      const { url } = await uploadsApi.upload(file)
      const updated = await expertsApi.updateProfile(profile.expert_profile_id, { profile_photo_url: url })
      setProfile(updated)
      // Otherwise the navbar circle keeps showing the old photo/initials
      // until the next full session refresh (e.g. a page reload).
      refreshUser().catch(() => {})
    } catch (err) {
      setPhotoError(err.body?.error?.message ?? 'Could not upload photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleRespond(connectionId, status) {
    setRespondingId(connectionId)
    setError('')
    try {
      await connectionsApi.respond(connectionId, status)
      const [conns, engs] = await Promise.all([connectionsApi.listForExpert(), engagementsApi.listForExpert()])
      setConnections(conns)
      setEngagements(engs)
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not update this request. Please try again.')
    } finally {
      setRespondingId(null)
    }
  }

  async function handleAcceptWithTimeline(e, connectionId) {
    e.preventDefault()
    setRespondingId(connectionId)
    setError('')
    try {
      const connection = connections.find((c) => c.connection_id === connectionId)
      const engagementType = timelineForm.engagement_type
      await connectionsApi.respond(connectionId, 'accepted')
      const engData = {
        connection_id: connectionId,
        engagement_type: engagementType,
        title: `${labelize(engagementType)} — ${connection?.org_name}`,
      }
      if (timelineForm.start_date)          engData.start_date          = timelineForm.start_date
      if (timelineForm.estimated_end_date)  engData.estimated_end_date  = timelineForm.estimated_end_date
      if (timelineForm.description)         engData.description         = timelineForm.description
      await engagementsApi.create(engData)
      const [conns, engs] = await Promise.all([connectionsApi.listForExpert(), engagementsApi.listForExpert()])
      setConnections(conns)
      setEngagements(engs)
      setProposingFor(null)
      setTimelineForm({ engagement_type: '', start_date: '', estimated_end_date: '', description: '' })
    } catch (err) {
      setError(err.body?.error?.message ?? 'Could not accept this request. Please try again.')
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
                  required
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

              <div className="field-group">
                <label className="field-label">Specializations</label>
                <div className="row gap-8 wrap" style={{ marginBottom: pendingSpecs.length ? 10 : 0 }}>
                  {pendingSpecs.length === 0 && (
                    <p style={{ fontSize: 12.5, color: 'var(--danger, #c0392b)' }}>
                      Required — add at least one specialization below.
                    </p>
                  )}
                  {pendingSpecs.map((s) => (
                    <span key={s.specialization} className="chip on">
                      {labelize(s.specialization)} <span className="tag" style={{ marginLeft: 4 }}>{labelize(s.proficiency_level)}</span>
                      <button
                        type="button"
                        onClick={() => removePendingSpecialization(s.specialization)}
                        aria-label={`Remove ${labelize(s.specialization)}`}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', marginLeft: 4, fontSize: 13 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="row gap-8 wrap" style={{ alignItems: 'flex-end' }}>
                  <div className="field-group">
                    <label className="field-label">Specialization</label>
                    <select
                      className="field-input"
                      value={newSpecForm.specialization}
                      onChange={(e) => setNewSpecForm((prev) => ({ ...prev, specialization: e.target.value }))}
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
                      value={newSpecForm.proficiency_level}
                      onChange={(e) => setNewSpecForm((prev) => ({ ...prev, proficiency_level: e.target.value }))}
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
                      value={newSpecForm.years_in_specialization}
                      onChange={(e) => setNewSpecForm((prev) => ({ ...prev, years_in_specialization: e.target.value }))}
                    />
                  </div>
                  <button className="btn btn-sm" type="button" onClick={addPendingSpecialization}>
                    Add
                  </button>
                </div>
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
                    required
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
                  required
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

  // ---------------- Post-creation: identity verification prompt ----------------

  if (verifyPrompt) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 540 }}>
          <span className="section-label" style={{ color: 'var(--acc)' }}>expert dashboard</span>
          <h1 className="h2" style={{ margin: '10px 0 6px' }}>Profile created</h1>
          <p className="lead" style={{ marginBottom: 24 }}>
            Would you like to submit an identity verification request? Verified experts appear higher
            in search results and build trust with organizations faster.
          </p>
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="row gap-10">
            <button
              className="btn btn-acc"
              disabled={verifying}
              onClick={handleRequestIdentityVerification}
            >
              {verifying ? 'Submitting…' : 'Request identity verification'}
            </button>
            <button className="btn" onClick={() => setVerifyPrompt(false)}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- Profile exists: Overview / Profile tabs ----------------

  const pendingRequests = connections.filter((c) => c.status === 'pending')
  const activeEngagements = engagements.filter((e) => !['completed', 'cancelled'].includes(e.status))

  // Past items = declined/expired connections + completed/cancelled engagements
  const _pastConnections = connections
    .filter((c) => ['declined', 'expired'].includes(c.status))
    .map((c) => ({ id: `conn-${c.connection_id}`, label: c.org_name, status: c.status, link: null }))
  const _pastEngagements = engagements
    .filter((e) => ['completed', 'cancelled'].includes(e.status))
    .map((e) => ({
      id: `eng-${e.engagement_id}`, label: e.title || labelize(e.engagement_type), status: e.status,
      link: `/engagements/${e.engagement_id}`,
      needsReview: e.status === 'completed' && !e.my_review_submitted,
    }))
  const allPastItems = [..._pastConnections, ..._pastEngagements]

  const DISMISSED_KEY = `qc_dismissed_${user?.user_id}`

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
          <button className={`dash-tab ${tab === 'overview' ? 'on' : ''}`} onClick={() => navigate('/dashboard')}>
            Overview
          </button>
          <button className={`dash-tab ${tab === 'profile' ? 'on' : ''}`} onClick={() => navigate('/dashboard?tab=profile')}>
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
                  <div key={c.connection_id} className="dash-request-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                    <div className="row gap-8 wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="row gap-8 wrap" style={{ marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{c.org_name}</span>
                          {c.org_is_verified && <span className="badge" style={{ fontSize: 11 }}>✓ Verified</span>}
                          <span className="tag">{labelize(c.org_sector)}</span>
                          {c.sub_sector && <span className="tag">{c.sub_sector}</span>}
                          <span className="tag">Match {Math.round(c.match_score)}%</span>
                        </div>

                        {/* Request details */}
                        <p className="lead" style={{ fontSize: 12.5, marginBottom: 6 }}>{c.initial_message}</p>
                        <div className="row gap-8 wrap" style={{ marginBottom: 10 }}>
                          {c.org_stated_need && <span className="tag" style={{ fontSize: 11 }}>{labelize(c.org_stated_need)}</span>}
                          {c.org_stated_timeline && <span className="tag" style={{ fontSize: 11 }}>Timeline: {labelize(c.org_stated_timeline)}</span>}
                        </div>

                        {/* Org profile details */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {c.org_description && (
                            <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #666)', margin: 0 }}>{c.org_description}</p>
                          )}
                          <div className="row gap-8 wrap">
                            {c.org_avg_rating != null && <RatingStars rating={c.org_avg_rating} label="org reviews" />}
                            {c.employee_count_range && <span className="tag" style={{ fontSize: 11 }}>{c.employee_count_range} employees</span>}
                            {c.country && <span className="tag" style={{ fontSize: 11 }}>{c.country}</span>}
                            {c.budget_range && <span className="tag" style={{ fontSize: 11 }}>{BUDGET_RANGE_LABEL[c.budget_range] ?? labelize(c.budget_range)}</span>}
                            {c.urgency_level && <span className="tag" style={{ fontSize: 11 }}>Urgency: {labelize(c.urgency_level)}</span>}
                            {c.quantum_knowledge_level && <span className="tag" style={{ fontSize: 11 }}>QC knowledge: {labelize(c.quantum_knowledge_level)}</span>}
                          </div>
                          {c.contact_name && (
                            <span style={{ fontSize: 11.5, color: 'var(--fg-muted, #666)' }}>
                              Contact: {c.contact_name}{c.contact_title ? ` · ${c.contact_title}` : ''}
                            </span>
                          )}
                          {c.website && (
                            <a href={c.website} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--acc)' }}>
                              {c.website} ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="row gap-8" style={{ flex: 'none' }}>
                        <button
                          className="btn btn-sm"
                          disabled={respondingId === c.connection_id}
                          onClick={() => handleRespond(c.connection_id, 'declined')}
                        >
                          Decline
                        </button>
                        {proposingFor === c.connection_id ? (
                          <button
                            className="btn btn-sm"
                            onClick={() => setProposingFor(null)}
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            className="btn btn-acc btn-sm"
                            disabled={respondingId === c.connection_id}
                            onClick={() => {
                              setProposingFor(c.connection_id)
                              setTimelineForm({ engagement_type: c.org_stated_need || '', start_date: '', estimated_end_date: '', description: '' })
                            }}
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </div>

                    {proposingFor === c.connection_id && (
                      <form onSubmit={(e) => handleAcceptWithTimeline(e, c.connection_id)} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <span className="section-label" style={{ fontSize: 11 }}>Propose a timeline</span>
                        <div className="field-group">
                          <label className="field-label">
                            Engagement type
                            {!c.org_stated_need && (
                              <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: 4 }}>— org was unsure, you decide</span>
                            )}
                          </label>
                          <select
                            className="field-input"
                            required
                            value={timelineForm.engagement_type}
                            onChange={(e) => setTimelineForm((p) => ({ ...p, engagement_type: e.target.value }))}
                          >
                            <option value="" disabled>— Select a type —</option>
                            {ENGAGEMENT_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="row gap-10">
                          <div className="field-group" style={{ flex: 1 }}>
                            <label className="field-label">Start date</label>
                            <input
                              className="field-input"
                              type="date"
                              min={todayStr}
                              value={timelineForm.start_date}
                              onChange={(e) => setTimelineForm((p) => ({ ...p, start_date: e.target.value }))}
                            />
                          </div>
                          <div className="field-group" style={{ flex: 1 }}>
                            <label className="field-label">Estimated end date</label>
                            <input
                              className="field-input"
                              type="date"
                              min={timelineForm.start_date || todayStr}
                              value={timelineForm.estimated_end_date}
                              onChange={(e) => setTimelineForm((p) => ({ ...p, estimated_end_date: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="field-group">
                          <label className="field-label">Initial description (optional)</label>
                          <textarea
                            className="field-input"
                            rows={2}
                            value={timelineForm.description}
                            onChange={(e) => setTimelineForm((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Briefly describe your approach or scope…"
                          />
                        </div>
                        <button
                          className="btn btn-acc"
                          type="submit"
                          disabled={respondingId === c.connection_id}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          {respondingId === c.connection_id ? 'Accepting…' : 'Confirm & Accept'}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <span className="section-label">Engagements</span>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeEngagements.length === 0 && (
                  <p className="lead" style={{ fontSize: 12.5 }}>
                    No active engagements — accept a request above to get started.
                  </p>
                )}
                {activeEngagements.map((e) => (
                  <Link key={e.engagement_id} to={`/engagements/${e.engagement_id}`} className="eng-list-row">
                    <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{e.title}</span>
                      <span className={e.status === 'active' ? 'badge' : 'tag'}>{labelize(e.status)}</span>
                    </div>
                    <MilestoneMap milestones={e.milestones} />
                  </Link>
                ))}
              </div>
            </div>

            {pastItems.length > 0 && (
              <div className="card" style={{ padding: 22 }}>
                <div className="row gap-8" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
                  <span className="section-label">Past requests</span>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={clearAllPast}
                  >
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
                        {item.needsReview && (
                          <Link to={item.link} className="badge" style={{ fontSize: 11 }}>
                            Review available
                          </Link>
                        )}
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
          </div>
        )}

        {tab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <form onSubmit={handleSave} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span className="section-label">Profile</span>

                <div className="field-group">
                  <label className="field-label">Profile photo</label>
                  <div className="row gap-10" style={{ alignItems: 'center' }}>
                    <span className="avatar" style={{ width: 52, height: 52, fontSize: 16, overflow: 'hidden' }}>
                      {profile.profile_photo_url ? (
                        <img
                          src={profile.profile_photo_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        `${profile.first_name[0]}${profile.last_name[0]}`
                      )}
                    </span>
                    <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                      {uploadingPhoto ? 'Uploading…' : profile.profile_photo_url ? 'Change photo' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        disabled={uploadingPhoto}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUploadPhoto(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                  {photoError && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{photoError}</p>}
                </div>

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
                  {profile.specializations.length === 0 && (
                    <p style={{ fontSize: 12.5, color: 'var(--danger, #c0392b)' }}>
                      Required — add at least one specialization below to complete your profile.
                    </p>
                  )}
                  {profile.specializations.map((s) => (
                    <span key={s.specialization_id} className="chip on">
                      {labelize(s.specialization)} <span className="tag" style={{ marginLeft: 4 }}>{labelize(s.proficiency_level)}</span>
                      {profile.specializations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecialization(s.specialization_id)}
                          aria-label={`Remove ${labelize(s.specialization)}`}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', marginLeft: 4, fontSize: 13 }}
                        >
                          ×
                        </button>
                      )}
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

              <div className="card" style={{ padding: 22 }}>
                <span className="section-label">Credentials</span>
                {credError && <div className="alert alert-error" style={{ margin: '10px 0' }}>{credError}</div>}
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(profile.credentials || []).length === 0 && (
                    <p className="lead" style={{ fontSize: 12.5 }}>No credentials added yet.</p>
                  )}
                  {(profile.credentials || []).map((c) => {
                    const status = credentialStatus(c.credential_id)
                    return (
                    <div key={c.credential_id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="row gap-8 wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.credential_name}</div>
                        <div className="lead" style={{ fontSize: 12, marginTop: 2 }}>
                          {labelize(c.credential_type)}{c.institution ? ` · ${c.institution}` : ''}{c.year_obtained ? ` · ${c.year_obtained}` : ''}
                        </div>
                      </div>
                      <div className="row gap-8">
                        {status === 'approved' && (
                          <span className="tag" style={{ color: 'var(--acc)' }}>Verified</span>
                        )}
                        {status === 'pending' && (
                          <span className="tag">Pending review</span>
                        )}
                        {status === 'rejected' && (
                          <span className="tag" style={{ color: 'var(--danger)' }}>Rejected</span>
                        )}
                        {status !== 'approved' && status !== 'pending' && (
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              if (verifyFormFor === c.credential_id) {
                                setVerifyFormFor(null)
                              } else {
                                setVerifyFormFor(c.credential_id)
                                setVerifyDocUrls([])
                              }
                            }}
                          >
                            {verifyFormFor === c.credential_id ? 'Cancel' : 'Request verification'}
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          style={{ color: 'var(--muted)' }}
                          onClick={() => handleDeleteCredential(c.credential_id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const latest = latestVerificationFor(c.credential_id)
                      if (!latest) return null
                      if (latest.status === 'approved' && latest.admin_notes) {
                        return (
                          <p className="lead" style={{ fontSize: 12, marginTop: 4, color: 'var(--acc)' }}>
                            Approved: {latest.admin_notes}
                          </p>
                        )
                      }
                      if (latest.status === 'rejected' && latest.rejection_reason) {
                        return (
                          <p style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }}>
                            Rejected: {latest.rejection_reason}
                          </p>
                        )
                      }
                      return null
                    })()}

                    {verifyFormFor === c.credential_id && (
                      <div style={{ marginTop: 10, padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
                        <TagInput
                          label="Supporting documents (optional)"
                          values={verifyDocUrls}
                          onChange={setVerifyDocUrls}
                          placeholder="https://... (link to a certificate image or PDF)"
                        />
                        <div style={{ marginTop: 8 }}>
                          <label className="btn btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                            {uploadingDoc ? 'Uploading…' : 'Upload from your computer'}
                            <input
                              type="file"
                              accept="application/pdf,image/png,image/jpeg,image/webp"
                              style={{ display: 'none' }}
                              disabled={uploadingDoc}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadDocument(file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {uploadError && (
                            <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{uploadError}</p>
                          )}
                        </div>
                        <button
                          className="btn btn-acc btn-sm"
                          style={{ marginTop: 10 }}
                          disabled={submittingVerification}
                          onClick={() => handleRequestCredentialVerification(c.credential_id, verifyDocUrls)}
                        >
                          {submittingVerification ? 'Submitting…' : 'Submit request'}
                        </button>
                      </div>
                    )}
                    </div>
                  )})}
                </div>

                <form onSubmit={handleAddCredential} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="section-label" style={{ fontSize: 11 }}>Add credential</span>
                  <div className="row gap-10 wrap">
                    <div className="field-group" style={{ flex: '0 0 140px' }}>
                      <label className="field-label">Type</label>
                      <select
                        className="field-input"
                        value={credForm.credential_type}
                        onChange={(e) => setCredForm((p) => ({ ...p, credential_type: e.target.value }))}
                      >
                        {CREDENTIAL_TYPES.map((t) => (
                          <option key={t} value={t}>{labelize(t)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group" style={{ flex: 1 }}>
                      <label className="field-label">Name</label>
                      <input
                        className="field-input"
                        required
                        placeholder="e.g. CISSP, BSc Computer Science"
                        value={credForm.credential_name}
                        onChange={(e) => setCredForm((p) => ({ ...p, credential_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="row gap-10 wrap">
                    <div className="field-group" style={{ flex: 1 }}>
                      <label className="field-label">Institution</label>
                      <input
                        className="field-input"
                        placeholder="Issuing body or school"
                        value={credForm.institution}
                        onChange={(e) => setCredForm((p) => ({ ...p, institution: e.target.value }))}
                      />
                    </div>
                    <div className="field-group" style={{ flex: '0 0 100px' }}>
                      <label className="field-label">Year</label>
                      <input
                        type="number"
                        min="1950"
                        max="2100"
                        className="field-input"
                        value={credForm.year_obtained}
                        onChange={(e) => setCredForm((p) => ({ ...p, year_obtained: e.target.value }))}
                      />
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button className="btn btn-sm btn-acc" type="submit" disabled={addingCred}>
                        {addingCred ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <ChangePasswordCard />
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
