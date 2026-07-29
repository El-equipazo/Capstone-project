import { Link } from 'react-router-dom'
import { formatRate, formatYearsOfExperience, labelize, AVAILABILITY_LABEL } from '../utils/format'

export default function ExpertCard({ expert }) {
  const initials = `${expert.first_name[0]}${expert.last_name[0]}`
  const topSpecialties = (expert.specializations ?? []).slice(0, 3)
  const fillPct = Math.max(0, Math.min(1, (expert.avg_rating ?? 0) / 5)) * 100

  return (
    <div className="card expert-card">
      <div className="ec-top">
        <span className="avatar ec-avatar">
          {initials}
          {expert.is_verified && (
            <span className="ec-verified-dot" title="Verified">
              ✓
            </span>
          )}
        </span>
        <div className="ec-top-text">
          <div className="ec-name-row">
            <h3 className="ec-name">
              {expert.first_name} {expert.last_name}
            </h3>
            {formatYearsOfExperience(expert.years_of_experience) != null && (
              <span className="ec-exp-pill">{formatYearsOfExperience(expert.years_of_experience)}+ yrs exp</span>
            )}
          </div>
          <p className="ec-role">{expert.headline}</p>
          <div className="ec-rating-row">
            <span className="star-rating" aria-hidden="true">
              <span className="star-rating-bg">★★★★★</span>
              <span className="star-rating-fg" style={{ width: `${fillPct}%` }}>
                ★★★★★
              </span>
            </span>
            <span className="ec-rating-num">{expert.avg_rating ? expert.avg_rating.toFixed(1) : 'New'}</span>
            <span className="ec-rating-count">({expert.total_completed_engagements} engagements)</span>
          </div>
        </div>
      </div>

      <div className="ec-divider" />

      <div className="ec-facts">
        <p className="ec-fact">
          <span className="ec-fact-label">Availability:</span> <strong>{AVAILABILITY_LABEL[expert.availability_status]}</strong>
        </p>
        <p className="ec-fact">
          <span className="ec-fact-label">Rate:</span> <strong>{formatRate(expert.hourly_rate_min, expert.hourly_rate_max)}</strong>
        </p>
        <div className="ec-expertise-row">
          <span className="ec-fact-label">Expertise:</span>
          <div className="ec-chip-row">
            {topSpecialties.map((s) => (
              <span key={s.specialization_id} className="ec-chip">
                {labelize(s.specialization)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="ec-divider" />

      <Link to={`/experts/${expert.expert_profile_id}`} className="btn btn-solid btn-block ec-cta">
        View Profile →
      </Link>
    </div>
  )
}
