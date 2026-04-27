export function formatDateFromIso(dateIso) {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return ''
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatSessionDate(session) {
  if (session?.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(session.dateIso)) {
    return formatDateFromIso(session.dateIso)
  }
  return session?.date ?? ''
}

export function formatTimeDisplay(time24) {
  if (!time24 || !/^\d{2}:\d{2}$/.test(time24)) return time24 ?? ''
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}
