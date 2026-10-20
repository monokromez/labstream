/** Format date values for display as MM/DD/YYYY. */
export function formatDate(value) {
  if (!value) return '—'

  const dateOnly = typeof value === 'string'
    ? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    : null

  if (dateOnly) return `${dateOnly[2]}/${dateOnly[3]}/${dateOnly[1]}`

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}
