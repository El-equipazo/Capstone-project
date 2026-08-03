export default function RatingStars({ rating, count, label = 'completed engagements' }) {
  if (rating == null) {
    return <span className="tag">New</span>
  }
  return (
    <span className="tag" title={count ? `${count} ${label}` : undefined}>
      ★ {rating.toFixed(1)}
    </span>
  )
}
