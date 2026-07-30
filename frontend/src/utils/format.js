export function labelize(value) {
  if (!value) return ''
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatRate(min, max) {
  if (min == null && max == null) return 'Rate on request'
  const fmt = (n) => `$${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)}–${fmt(max)}/hr`
  return `${fmt(min ?? max)}/hr`
}

export function formatCurrencyRange(min, max) {
  const fmt = (n) => `$${Number(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  return fmt(min ?? max)
}

// null/undefined means "not set"; 0 also isn't worth displaying ("0+ yrs exp"
// reads as broken, not as a real data point) -- both render as nothing at the
// call site instead of a value. Returns the raw number (not a fixed string)
// since callers phrase it differently ("X+ yrs exp" vs "X yrs experience").
export function formatYearsOfExperience(years) {
  return years ? years : null
}

// organization_profiles.budget_range enum — labelize() would render '10k_50k'
// as "10k 50k" (just a space, no indication it's a range), so this gets its
// own explicit label map instead.
export const BUDGET_RANGE_LABEL = {
  under_10k: 'Under $10k',
  '10k_50k': '$10k–$50k',
  '50k_250k': '$50k–$250k',
  '250k_plus': '$250k+',
  undisclosed: 'Undisclosed',
}

export const PAYMENT_STRUCTURE_OPTIONS = [
  { value: 'hourly',          label: 'Hourly' },
  { value: 'fixed_price',     label: 'Fixed Price' },
  { value: 'milestone_based', label: 'Milestone Based' },
  { value: 'retainer',        label: 'Retainer' },
]

export const ENGAGEMENT_TYPE_OPTIONS = [
  { value: 'risk_assessment',      label: 'Risk Assessment' },
  { value: 'cryptographic_audit',  label: 'Cryptographic Audit' },
  { value: 'migration_roadmap',    label: 'Migration Roadmap' },
  { value: 'executive_briefing',   label: 'Executive Briefing' },
  { value: 'staff_training',       label: 'Staff Training' },
  { value: 'ongoing_advisory',     label: 'Ongoing Advisory' },
  { value: 'compliance_review',    label: 'Compliance Review' },
  { value: 'full_migration_support', label: 'Full Migration Support' },
]

export const AVAILABILITY_LABEL = {
  available: 'Available',
  limited: 'Limited availability',
  unavailable: 'Unavailable',
  booking_future: 'Booking future dates',
}

export function formatWorkPeriod(startDate, endDate) {
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  return `${fmt(startDate)} – ${endDate ? fmt(endDate) : 'Present'}`
}

export function toNumberOrNull(value) {
  return value === '' ? null : Number(value)
}

// Shared by Login and SignUp so both land a freshly authenticated user in the
// same place for their role, rather than each page reimplementing its own copy.
export function landingPathFor(role) {
  if (role === 'organization') return '/organization'
  if (role === 'expert') return '/dashboard'
  if (role === 'admin') return '/admin'
  return '/'
}
