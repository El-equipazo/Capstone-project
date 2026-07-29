import { Fragment, useState } from 'react'
import { labelize, BUDGET_RANGE_LABEL } from '../../utils/format'

// expert_profiles has no equivalent to this on the org side yet — schema.md's
// organization_profiles.employee_count_range enum.
const EMPLOYEE_COUNT_OPTIONS = ['<50', '50-250', '250-1k', '1k-10k', '>10k']
const BUDGET_RANGE_OPTIONS = ['under_10k', '10k_50k', '50k_250k', '250k_plus', 'undisclosed']
const URGENCY_OPTIONS = ['just_exploring', 'planning_ahead', 'urgent', 'critical']

const STEP_LABELS = ['Personal details', 'Company profile', 'Invite team']

// Presentational only — doesn't know about client.js or auth. The parent page
// owns the actual API call and decides what to do with a blank org_name
// (schema.md marks it NOT NULL), passed back via onComplete(formData).
export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    contact_name: '',
    contact_title: '',
    org_name: '',
    employee_count_range: EMPLOYEE_COUNT_OPTIONS[0],
    sub_sector: '',
    org_description: '',
    budget_range: '',
    urgency_level: '',
  })
  const [emails, setEmails] = useState([''])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateEmail(index, value) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  function addEmailRow() {
    setEmails((prev) => [...prev, ''])
  }

  function removeEmailRow(index) {
    setEmails((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  function finish() {
    onComplete({
      ...form,
      invite_emails: emails.map((e) => e.trim()).filter(Boolean),
    })
  }

  const step1Valid = form.contact_name.trim() !== '' && form.contact_title.trim() !== ''
  const step2Valid = form.org_name.trim() !== '' && form.budget_range !== '' && form.urgency_level !== ''

  return (
    <div className="card" style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
      <div className="onboard-steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const status = n === step ? 'on' : n < step ? 'done' : ''
          return (
            <Fragment key={label}>
              <div className={`onboard-step ${status}`}>
                <span className="n">{n < step ? '✓' : n}</span>
                {label}
              </div>
              {n < STEP_LABELS.length && <div className="onboard-step-line" />}
            </Fragment>
          )
        })}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 className="h2" style={{ fontSize: 18, marginBottom: 4 }}>
              Tell us about you
            </h2>
            <p className="lead" style={{ fontSize: 12.5 }}>
              Who's the primary point of contact for this account?
            </p>
          </div>
          <div className="field-group">
            <label className="field-label">Your name</label>
            <input
              className="field-input"
              value={form.contact_name}
              onChange={(e) => updateField('contact_name', e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Your role</label>
            <input
              className="field-input"
              value={form.contact_title}
              onChange={(e) => updateField('contact_title', e.target.value)}
              placeholder="e.g. Head of Security, CISO"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 className="h2" style={{ fontSize: 18, marginBottom: 4 }}>
              Company profile
            </h2>
            <p className="lead" style={{ fontSize: 12.5 }}>
              This is what quantum-security experts will see about your organization.
            </p>
          </div>
          <div className="field-group">
            <label className="field-label">Company name</label>
            <input
              className="field-input"
              required
              value={form.org_name}
              onChange={(e) => updateField('org_name', e.target.value)}
              placeholder="Acme Bank"
            />
          </div>
          <div className="row gap-10">
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">Company size</label>
              <select
                className="field-input"
                value={form.employee_count_range}
                onChange={(e) => updateField('employee_count_range', e.target.value)}
              >
                {EMPLOYEE_COUNT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o} employees
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">Industry</label>
              <input
                className="field-input"
                value={form.sub_sector}
                onChange={(e) => updateField('sub_sector', e.target.value)}
                placeholder="e.g. Retail banking, Payments"
              />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Company description</label>
            <textarea
              className="field-input"
              rows={3}
              value={form.org_description}
              onChange={(e) => updateField('org_description', e.target.value)}
              placeholder="Optional — what does your organization do?"
            />
          </div>
          <div className="row gap-10">
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">Budget range</label>
              <select
                className="field-input"
                required
                value={form.budget_range}
                onChange={(e) => updateField('budget_range', e.target.value)}
              >
                <option value="" disabled>— Select —</option>
                {BUDGET_RANGE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {BUDGET_RANGE_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group" style={{ flex: 1 }}>
              <label className="field-label">Urgency</label>
              <select
                className="field-input"
                required
                value={form.urgency_level}
                onChange={(e) => updateField('urgency_level', e.target.value)}
              >
                <option value="" disabled>— Select —</option>
                {URGENCY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {labelize(o)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 className="h2" style={{ fontSize: 18, marginBottom: 4 }}>
              Invite your team
            </h2>
            <p className="lead" style={{ fontSize: 12.5 }}>
              Bring in teammates who'll help evaluate and engage experts. You can always do this
              later.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emails.map((email, i) => (
              <div key={i} className="row gap-8">
                <input
                  type="email"
                  className="field-input"
                  style={{ flex: 1 }}
                  placeholder="teammate@yourcompany.com"
                  value={email}
                  onChange={(e) => updateEmail(i, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => removeEmailRow(i)}
                  aria-label={`Remove email ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addEmailRow}>
            + Add another
          </button>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 28 }}>
        <div>
          {step > 1 && (
            <button type="button" className="btn btn-sm" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
          )}
        </div>
        <div className="row gap-10">
          {step === 3 && (
            <button type="button" className="btn btn-sm" onClick={finish}>
              Skip
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="btn btn-acc"
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              onClick={() => setStep((s) => s + 1)}
            >
              Next →
            </button>
          ) : (
            <button type="button" className="btn btn-acc" onClick={finish}>
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
