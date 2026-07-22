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
