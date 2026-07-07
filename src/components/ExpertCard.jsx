import { Link } from 'react-router-dom'
import VerifiedBadge from './VerifiedBadge'
import RatingStars from './RatingStars'
import { formatRate, labelize, AVAILABILITY_LABEL } from '../utils/format'

export default function ExpertCard({ expert }) {
  const topSpecializations = expert.specializations.slice(0, 2)
  const initials = `${expert.first_name[0]}${expert.last_name[0]}`

  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
        <span className="avatar" style={{ width: 42, height: 42, fontSize: 14 }}>
          {initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-8 wrap" style={{ justifyContent: 'space-between' }}>
            <h3 className="h2" style={{ fontSize: 15 }}>
              {expert.first_name} {expert.last_name}
            </h3>
            <VerifiedBadge verified={expert.is_verified} />
          </div>
          <p className="lead" style={{ fontSize: 12.5, marginTop: 3 }}>
            {expert.headline}
          </p>
        </div>
      </div>

      <div className="row gap-6 wrap">
        {topSpecializations.map((s) => (
          <span key={s.specialization_id} className="chip on">
            {labelize(s.specialization)}
          </span>
        ))}
        <RatingStars rating={expert.avg_rating} count={expert.total_completed_engagements} />
      </div>

      <div className="row gap-6 wrap">
        <span className="tag">{formatRate(expert.hourly_rate_min, expert.hourly_rate_max)}</span>
        <span className="tag">{AVAILABILITY_LABEL[expert.availability_status]}</span>
        <span className="tag">{expert.years_of_experience} yrs experience</span>
      </div>

      <Link to={`/experts/${expert.expert_profile_id}`} className="btn btn-sm" style={{ marginTop: 4 }}>
        View profile
      </Link>
    </div>
  )
}
