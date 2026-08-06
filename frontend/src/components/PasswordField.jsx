import { useId, useState } from 'react'

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.6-7 10-7c1.8 0 3.4.4 4.8 1.1M22 12s-1.4 2.7-3.9 4.6M6.5 6.5 2 2m20 20-4.5-4.5M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

// A password <input> with a tap-to-reveal toggle, wired up the same way as
// a plain field-input/field-label pair everywhere else in the app -- drop
// it in wherever a raw <input type="password"> was, minus the type prop.
export default function PasswordField({
  id, label, value, onChange, required, minLength, autoComplete, placeholder, hint, inputStyle,
}) {
  const [visible, setVisible] = useState(false)
  const autoId = useId()
  const fieldId = id || autoId

  return (
    <div className="field-group">
      {label && <label className="field-label" htmlFor={fieldId}>{label}</label>}
      <div className="password-field-wrap">
        <input
          id={fieldId}
          type={visible ? 'text' : 'password'}
          className="field-input"
          style={inputStyle}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
