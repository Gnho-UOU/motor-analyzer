export const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export const clamp = (value, min, max) => {
  const numeric = toFiniteNumber(value, min)
  return Math.min(max, Math.max(min, numeric))
}

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

export function formatCompact(value, digits = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    maximumFractionDigits: digits,
  })
}

export function toProfileNumber(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback
  }

  return toFiniteNumber(value, fallback)
}

export function getLocalDateString() {
  const now = new Date()
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}
