import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { expertsApi } from '../api/client'
import VerifiedBadge from '../components/VerifiedBadge'
import RatingStars from '../components/RatingStars'
import { useAuth } from '../context/AuthContext'
import { formatRate, formatCurrencyRange, labelize, AVAILABILITY_LABEL } from '../utils/format'

export default function ExpertProfile() {
  const { expertId } = useParams()
  const [expert, setExpert] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setExpert(null)
    setNotFound(false)
    setRequestSent(false)
    expertsApi
      .getById(expertId)
      .then(setExpert)
      .catch(() => setNotFound(true))
  }, [expertId])

  function handleRequestAssessment() {
    if (!user) {
      navigate(`/login?next=/experts/${expertId}`)
      return
    }
    // POST /connections would fire here against the real API.
    setRequestSent(true)
  }

  if (notFound) {
    return (
      <div className="page">
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
      <div className="page">
        <div className="container">
          <p className="lead">Loading profile…</p>
        </div>
      </div>
    )
  }

  const initials = `${expert.first_name[0]}${expert.last_name[0]}`

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 880 }}>
        <Link to="/experts" className="lead" style={{ fontSize: 12.5, display: 'inline-block', marginBottom: 16 }}>
          ← Back to directory
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div className="card" style={{ padding: 24 }}>
              <div className="row gap-14" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
                <span className="avatar" style={{ width: 60, height: 60, fontSize: 18 }}>
                  {initials}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="row gap-10 wrap" style={{ justifyContent: 'space-between' }}>
                    <h1 className="h2" style={{ fontSize: 21 }}>
                      {expert.first_name} {expert.last_name}
                    </h1>
                    <VerifiedBadge verified={expert.is_verified} />
                  </div>
                  <p className="lead" style={{ marginTop: 4 }}>
                    {expert.headline}
                  </p>
                  <div className="row gap-8 wrap" style={{ marginTop: 10 }}>
                    <RatingStars rating={expert.avg_rating} count={expert.total_completed_engagements} />
                    <span className="tag">{expert.total_completed_engagements} completed engagements</span>
                    <span className="tag">{expert.years_of_experience} yrs experience</span>
                  </div>
                </div>
              </div>
              <p className="lead">{expert.bio}</p>
            </div>

            {/* Specializations */}
            <Section title="Specializations">
              <div className="row gap-8 wrap">
                {expert.specializations.map((s) => (
                  <span key={s.specialization_id} className="chip on">
                    {labelize(s.specialization)}
                    <span className="tag" style={{ marginLeft: 4 }}>
                      {labelize(s.proficiency_level)}
                    </span>
                  </span>
                ))}
              </div>
            </Section>

            {/* Credentials */}
            <Section title="Credentials & certifications">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {expert.credentials.map((c) => (
                  <div key={c.credential_id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.credential_name}</div>
                      <div className="lead" style={{ fontSize: 11.5 }}>
                        {c.institution} · {c.year_obtained}
                      </div>
                    </div>
                    {c.is_admin_verified ? (
                      <span className="badge">✓ verified</span>
                    ) : (
                      <span className="badge pending">unverified</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* Sector experience */}
            <Section title="Sector experience & compliance">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {expert.sector_experience.map((s) => (
                  <div key={s.sector_exp_id}>
                    <div className="row gap-8 wrap" style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{labelize(s.sector)}</span>
                      <span className="tag">{s.years_experience_in_sector} yrs in sector</span>
                    </div>
                    <div className="row gap-6 wrap" style={{ marginBottom: 6 }}>
                      {s.compliance_standards_known.map((c) => (
                        <span key={c} className="tag">
                          {c}
                        </span>
                      ))}
                    </div>
                    {s.anonymized_client_examples && (
                      <p className="lead" style={{ fontSize: 12 }}>
                        {s.anonymized_client_examples}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* Engagement types */}
            <Section title="Engagement types & estimated timelines">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {expert.engagement_types.map((t) => (
                  <div key={t.eng_type_id} className="card2" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14 }}>
                    <div className="row gap-8 wrap" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{labelize(t.engagement_type)}</span>
                      <span className="tag">
                        {t.typical_duration_weeks_min}–{t.typical_duration_weeks_max} weeks
                      </span>
                    </div>
                    <p className="lead" style={{ fontSize: 12.5, marginBottom: 6 }}>
                      {t.approach_description}
                    </p>
                    <span className="tag">
                      Typical budget: {formatCurrencyRange(t.typical_budget_min, t.typical_budget_max)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Sidebar */}
          <aside style={{ position: 'sticky', top: 84, alignSelf: 'flex-start' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="stat">
                <span className="v">{formatRate(expert.hourly_rate_min, expert.hourly_rate_max)}</span>
                <span className="l">estimated rate</span>
              </div>
              <div className="stat">
                <span className="v">{AVAILABILITY_LABEL[expert.availability_status]}</span>
                <span className="l">availability · usually responds in {expert.avg_response_time_hours}h</span>
              </div>
              <div className="stat">
                <span className="v">{labelize(expert.preferred_engagement_length)}</span>
                <span className="l">preferred engagement length</span>
              </div>

              {requestSent ? (
                <div className="alert alert-success">Request sent — {expert.first_name} typically responds within {expert.avg_response_time_hours}h.</div>
              ) : (
                <button
                  className="btn btn-acc btn-block"
                  onClick={handleRequestAssessment}
                  disabled={expert.availability_status === 'unavailable'}
                >
                  {expert.availability_status === 'unavailable' ? 'Currently unavailable' : 'Request assessment'}
                </button>
              )}

              {expert.linkedin_url && (
                <a href={expert.linkedin_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-block">
                  View LinkedIn
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <span className="section-label">{title}</span>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}
