/** Roster player ids for a session (mock model uses `players`; legacy uses `playerIds`). */
export function sessionRosterIds(session) {
  if (!session) return []
  if (Array.isArray(session.players) && session.players.length) return session.players
  if (Array.isArray(session.playerIds) && session.playerIds.length) return session.playerIds
  return []
}
