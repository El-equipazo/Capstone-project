import { useEffect, useMemo, useState } from 'react'
import { expertsApi } from '../api/client'
import { SPECIALIZATIONS, SECTORS, ENGAGEMENT_TYPES } from '../data/mockExperts'
import ExpertCard from '../components/ExpertCard'
import { labelize } from '../utils/format'

const AVAILABILITY_OPTIONS = ['available', 'limited', 'unavailable']

const EMPTY_FILTERS = {
  q: '',
  specialization: '',
  sector: '',
  engagement_type: '',
  availability: '',
  rating_min: '',
}

export default function ExpertDirectory() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const handle = setTimeout(() => {
      expertsApi.list(filters).then((res) => {
        setResults(res.data)
        setLoading(false)
      })
    }, 150) // debounce so typing in the search box doesn't refetch on every keystroke
    return () => clearTimeout(handle)
  }, [filters])

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, v]) => key !== 'q' && v).length,
    [filters]
  )

  function toggleFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }))
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS)
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 22 }}>
          <span className="section-label" style={{ color: 'var(--acc)' }}>
            expert directory
          </span>
          <h1 className="h1" style={{ fontSize: 26, margin: '8px 0 6px' }}>
            Verified quantum-security experts for high-risk organizations
          </h1>
          <p className="lead">
            Filter by specialization, sector experience, engagement type, and availability to
            find the expert best suited to your risk profile.
          </p>
        </div>

        <div className="row gap-10" style={{ marginBottom: 20 }}>
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder="Search by name, headline, or risk area…"
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          />
          {activeFilterCount > 0 && (
            <button className="btn btn-sm" onClick={clearAll}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28 }}>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <FilterGroup label="Specialization">
              {SPECIALIZATIONS.map((s) => (
                <span
                  key={s}
                  className={`chip ${filters.specialization === s ? 'on' : ''}`}
                  onClick={() => toggleFilter('specialization', s)}
                >
                  {labelize(s)}
                </span>
              ))}
            </FilterGroup>

            <FilterGroup label="Sector experience">
              {SECTORS.map((s) => (
                <span
                  key={s}
                  className={`chip ${filters.sector === s ? 'on' : ''}`}
                  onClick={() => toggleFilter('sector', s)}
                >
                  {labelize(s)}
                </span>
              ))}
            </FilterGroup>

            <FilterGroup label="Engagement type">
              {ENGAGEMENT_TYPES.map((s) => (
                <span
                  key={s}
                  className={`chip ${filters.engagement_type === s ? 'on' : ''}`}
                  onClick={() => toggleFilter('engagement_type', s)}
                >
                  {labelize(s)}
                </span>
              ))}
            </FilterGroup>

            <FilterGroup label="Availability">
              {AVAILABILITY_OPTIONS.map((s) => (
                <span
                  key={s}
                  className={`chip ${filters.availability === s ? 'on' : ''}`}
                  onClick={() => toggleFilter('availability', s)}
                >
                  {labelize(s)}
                </span>
              ))}
            </FilterGroup>

            <FilterGroup label="Minimum rating">
              {['4', '4.5'].map((s) => (
                <span
                  key={s}
                  className={`chip ${filters.rating_min === s ? 'on' : ''}`}
                  onClick={() => toggleFilter('rating_min', s)}
                >
                  ★ {s}+
                </span>
              ))}
            </FilterGroup>
          </aside>

          <div>
            <div
              className="card"
              style={{
                padding: '14px 20px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--fill2)',
              }}
            >
              <span className="lead" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {loading ? 'Searching…' : `${results?.length ?? 0} expert${results?.length === 1 ? '' : 's'} match your filters`}
              </span>
              <span className="tag">verified only</span>
            </div>

            {!loading && results?.length === 0 && (
              <div className="empty-state card">
                <p style={{ fontWeight: 600, marginBottom: 6 }}>No experts match these filters</p>
                <p className="lead" style={{ fontSize: 12.5 }}>
                  Try clearing a filter or broadening your search.
                </p>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 14,
              }}
            >
              {(results ?? []).map((expert) => (
                <ExpertCard key={expert.expert_profile_id} expert={expert} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <span className="section-label">{label}</span>
      <div className="row gap-6 wrap" style={{ marginTop: 9 }}>
        {children}
      </div>
    </div>
  )
}
