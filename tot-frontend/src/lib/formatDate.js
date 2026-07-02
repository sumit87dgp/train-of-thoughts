/**
 * @param {string} isoString
 */
export function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = Date.now()
  const diffMs = date.getTime() - now
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }

  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day')
  }

  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

/**
 * @param {string} isoString
 */
export function formatDateTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
