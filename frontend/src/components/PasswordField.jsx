import { useId, useState } from 'react'

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
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
