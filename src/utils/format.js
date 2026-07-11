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
