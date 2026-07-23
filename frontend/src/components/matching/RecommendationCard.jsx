import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatRate, AVAILABILITY_LABEL } from '../../utils/format'

export default function RecommendationCard({ recommendation }) {
  const rec = recommendation
  const [showScoreInfo, setShowScoreInfo] = useState(false)
  const initials = `${rec.first_name[0]}${rec.last_name[0]}`
  const fillPct = Math.max(0, Math.min(1, (rec.avg_rating ?? 0) / 5)) * 100

  return (
    <div className="card expert-card">
      <div className="ec-top">
        <span className="avatar ec-avatar">
          {initials}
          {rec.is_verified && (
            <span className="ec-verified-dot" title="Verified">
              ✓
            </span>
          )}
        </span>
        <div className="ec-top-text">
          <div className="ec-name-row">
            <h3 className="ec-name">
              {rec.first_name} {rec.last_name}
            </h3>
            <div className="rec-scores">
              <span className="fit-score-badge">{Math.round(rec.profile_match_score)}% Profile</span>
              <span className="fit-score-badge">{rec.fit_score}% AI Fit</span>
              <button
                type="button"
                className="score-info-btn"
                onClick={() => setShowScoreInfo((v) => !v)}
                aria-label="What do these two scores mean?"
              >
                i
              </button>
              {showScoreInfo && (
                <div className="score-info-popover">
                  <p>
                    <strong>Profile Match</strong> is a fixed formula based on sector experience, compliance
                    overlap, budget fit, and availability — the same score you'd get by sending a request.
                  </p>
                  <p>
                    <strong>AI Fit</strong> is Gemini's live read of this expert against your profile and what
                    you typed, generated fresh each search and never stored.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="ec-role">{rec.headline}</p>
          <div className="ec-rating-row">
            <span className="star-rating" aria-hidden="true">
              <span className="star-rating-bg">★★★★★</span>
              <span className="star-rating-fg" style={{ width: `${fillPct}%` }}>
                ★★★★★
              </span>
            </span>
            <span className="ec-rating-num">{rec.avg_rating ? rec.avg_rating.toFixed(1) : 'New'}</span>
            <span className="ec-rating-count">({rec.total_completed_engagements} engagements)</span>
          </div>
        </div>
      </div>

      <div className="ec-divider" />

      <div className="ec-facts">
        <p className="ec-fact">
          <span className="ec-fact-label">Availability:</span> <strong>{AVAILABILITY_LABEL[rec.availability_status]}</strong>
        </p>
        <p className="ec-fact">
          <span className="ec-fact-label">Rate:</span> <strong>{formatRate(rec.hourly_rate_min, rec.hourly_rate_max)}</strong>
        </p>
      </div>

      <div className="ec-divider" />

      <div className="rec-reasoning">
        <p className="rec-reasoning-text">{rec.reasoning}</p>
        {rec.key_strengths.length > 0 && (
          <div className="ec-chip-row">
            {rec.key_strengths.map((strength) => (
              <span key={strength} className="tag">
                {strength}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link to={`/experts/${rec.expert_profile_id}`} className="btn btn-solid btn-block ec-cta">
        View Profile →
      </Link>
    </div>
  )
}
