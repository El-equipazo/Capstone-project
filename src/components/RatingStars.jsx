export default function RatingStars({ rating, count }) {
  if (rating == null) {
    return <span className="tag">New</span>
  }
  return (
    <span className="tag" title={count ? `${count} completed engagements` : undefined}>
      ★ {rating.toFixed(1)}
    </span>
  )
}
