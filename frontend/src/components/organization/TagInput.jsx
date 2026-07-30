import { useState } from 'react'

export default function TagInput({ label, values, onChange, suggestions = [], placeholder, restrictToSuggestions = false }) {
  const [text, setText] = useState('')

  function addValue(raw) {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...values, trimmed])
    setText('')
  }

  function removeValue(value) {
    onChange(values.filter((v) => v !== value))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addValue(text)
    }
  }

  const availableSuggestions = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())
  )

  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {!restrictToSuggestions && (
        <div className="row gap-8">
          <input
            className="field-input"
            style={{ flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
          <button type="button" className="btn btn-sm" onClick={() => addValue(text)}>
            Add
          </button>
        </div>
      )}
      {restrictToSuggestions && values.length === 0 && (
        <p className="lead" style={{ fontSize: 12, margin: '4px 0 0' }}>
          Pick from the options below.
        </p>
      )}

      {values.length > 0 && (
        <div className="ec-chip-row" style={{ marginTop: 8 }}>
          {values.map((v) => (
            <span key={v} className="tag-input-chip">
              {v}
              <button type="button" onClick={() => removeValue(v)} aria-label={`Remove ${v}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {availableSuggestions.length > 0 && (
        <div className="row gap-6 wrap" style={{ marginTop: 8 }}>
          {availableSuggestions.map((s) => (
            <button key={s} type="button" className="tag-suggest-btn" onClick={() => addValue(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
