export default function StarRatingInput({ value, onChange, label, required, disabled }) {
  return (
    <div className="field-group">
      {label && <label className="field-label">{label}{required && ' *'}</label>}
      <div className="row gap-4" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="star-input-btn"
            disabled={disabled}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n <= value ? '★' : '☆'}
          </button>
        ))}
      </div>
    </div>
  )
}
