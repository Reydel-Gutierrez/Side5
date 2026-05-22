/** Session is in Past (Game Hub stats pushed / no longer active). */
export function isPastSession(session) {
  if (!session) return false
  if (Boolean(session.stats_finalized) || Number(session.stats_finalized) === 1) return true
  const status = String(session.status || '').toLowerCase()
  return status === 'past' || status === 'completed'
}
