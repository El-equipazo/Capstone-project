import { useEffect, useRef, useState } from 'react'
import { organizationsApi, engagementsApi } from '../api/client'
import RatingStars from './RatingStars'
import { labelize, BUDGET_RANGE_LABEL } from '../utils/format'

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  )
}

export default function OrgProfileModal({ orgId, engagementId, onClose }) {
  const [org, setOrg] = useState(null)
  const [error, setError] = useState('')

  // Infrastructure is sensitive and gated server-side (owner/admin/connected
  // expert only, api-contract.md §3) -- 403/404 (not connected yet, or the
  // org hasn't filled it in) just means the section stays hidden, not an error.
  const [infra, setInfra] = useState(null)

  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState('') // '' | 'saving' | 'saved'
  const notesLoaded = useRef(false)

  useEffect(() => {
    organizationsApi.getById(orgId)
      .then(setOrg)
      .catch(() => setError('Could not load organization profile.'))
    organizationsApi.getInfrastructure(orgId).then(setInfra).catch(() => {})
    engagementsApi.getNotes(engagementId)
      .then((res) => { setNotes(res.content || ''); notesLoaded.current = true })
      .catch(() => { notesLoaded.current = true })
  }, [orgId, engagementId])

  async function saveNotes() {
    if (!notesLoaded.current) return
    setNotesStatus('saving')
    try {
      await engagementsApi.updateNotes(engagementId, notes)
      setNotesStatus('saved')
      setTimeout(() => setNotesStatus(''), 1500)
    } catch {
      setNotesStatus('')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', padding: 22 }}
      >
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="section-label">Organization Profile</span>
          <button onClick={onClose} className="btn btn-sm" type="button">Close</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!error && !org && <p className="lead" style={{ fontSize: 13 }}>Loading…</p>}

        {org && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row gap-8" style={{ alignItems: 'center' }}>
              <Field label="Company name" value={org.org_name} />
              {org.avg_rating != null && <RatingStars rating={org.avg_rating} label="org reviews" />}
            </div>
            <div className="row gap-10">
              <div style={{ flex: 1 }}><Field label="Industry" value={org.sub_sector} /></div>
              <div style={{ flex: 1 }}><Field label="Company size" value={org.employee_count_range ? `${org.employee_count_range} employees` : null} /></div>
            </div>
            <div className="row gap-10">
              <div style={{ flex: 1 }}><Field label="Contact name" value={org.contact_name} /></div>
              <div style={{ flex: 1 }}><Field label="Contact role" value={org.contact_title} /></div>
            </div>
            <div className="row gap-10">
              <div style={{ flex: 1 }}><Field label="Country" value={org.country} /></div>
              <div style={{ flex: 1 }}><Field label="Website" value={org.website} /></div>
            </div>
            <Field label="Company description" value={org.org_description} />
            <div className="row gap-10">
              <div style={{ flex: 1 }}>
                <Field label="Quantum knowledge level" value={org.quantum_knowledge_level ? labelize(org.quantum_knowledge_level) : null} />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Budget range" value={org.budget_range ? BUDGET_RANGE_LABEL[org.budget_range] : null} />
              </div>
              <div style={{ flex: 1 }}>
                <Field label="Urgency" value={org.urgency_level ? labelize(org.urgency_level) : null} />
              </div>
            </div>

            {infra && (
              <div className="field-group" style={{ marginTop: 8, borderTop: '1px solid var(--brd)', paddingTop: 16 }}>
                <label className="field-label" style={{ display: 'block', marginBottom: 8 }}>Infrastructure</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="row gap-10">
                    <div style={{ flex: 1 }}>
                      <Field label="Storage type" value={infra.storage_type ? labelize(infra.storage_type) : null} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Data retention" value={infra.data_retention_years ? `${infra.data_retention_years} years` : null} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Oldest system age" value={infra.oldest_system_age_years ? `${infra.oldest_system_age_years} years` : null} />
                    </div>
                  </div>
                  <Field label="Data categories" value={infra.data_categories?.length ? infra.data_categories.map(labelize).join(', ') : null} />
                  <Field label="Cloud providers" value={infra.primary_cloud_providers?.length ? infra.primary_cloud_providers.join(', ') : null} />
                  <Field label="Encryption standards" value={infra.current_encryption_standards?.length ? infra.current_encryption_standards.join(', ') : null} />
                  <Field label="Compliance requirements" value={infra.compliance_requirements?.length ? infra.compliance_requirements.join(', ') : null} />
                  <div className="row gap-10">
                    <div style={{ flex: 1 }}>
                      <Field label="Dedicated security team" value={infra.has_dedicated_security_team != null ? (infra.has_dedicated_security_team ? 'Yes' : 'No') : null} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Prior quantum assessment" value={infra.had_prior_quantum_assessment != null ? (infra.had_prior_quantum_assessment ? 'Yes' : 'No') : null} />
                    </div>
                  </div>
                  <Field label="Known risks" value={infra.known_risks_freetext} />
                </div>
              </div>
            )}

            <div className="field-group" style={{ marginTop: 8, borderTop: '1px solid var(--brd)', paddingTop: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="field-label">My Notes</label>
                {notesStatus === 'saving' && <span className="lead" style={{ fontSize: 11 }}>Saving…</span>}
                {notesStatus === 'saved' && <span className="lead" style={{ fontSize: 11 }}>Saved</span>}
              </div>
              <textarea
                className="field-input"
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Private notes only you can see…"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
