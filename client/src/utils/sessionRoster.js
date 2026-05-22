function rosterEntryId(entry) {
  if (entry == null) return null
  if (typeof entry === 'object') {
    const id = entry.user_id ?? entry.id ?? entry.playerId
    return id != null ? String(id) : null
  }
  return String(entry)
}

/** Roster player ids for a session (mock model uses `players`; legacy uses `playerIds`). */
export function sessionRosterIds(session) {
  if (!session) return []
  if (Array.isArray(session.players) && session.players.length) {
    return session.players.map(rosterEntryId).filter(Boolean)
  }
  if (Array.isArray(session.playerIds) && session.playerIds.length) {
    return session.playerIds.map(rosterEntryId).filter(Boolean)
  }
  return []
}

export function sessionRosterCount(session) {
  const ids = sessionRosterIds(session)
  if (ids.length) return ids.length
  if (typeof session.rosterCount === 'number' && Number.isFinite(session.rosterCount)) {
    return session.rosterCount
  }
  return 0
}
