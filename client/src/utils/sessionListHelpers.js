import { formatDateFromIso, formatTimeDisplay } from './sessionDisplay'
import { apiFetch } from './apiFetch'
import { isPastSession } from './sessionPast'

export { isPastSession }

/** Map API or mixed session row to client card model with formatted date/time. */
export function mapSessionForDisplay(session) {
  const timeRaw = session.session_time != null ? String(session.session_time) : session.time24 ?? ''
  const timeShort = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw
  const time24 = /^\d{2}:\d{2}$/.test(timeShort) ? timeShort : session.time24 || '12:00'

  let dateIso = session.dateIso ?? ''
  const sd = session.session_date ?? session.date
  if (!dateIso && sd instanceof Date && !Number.isNaN(sd.getTime())) {
    dateIso = sd.toISOString().slice(0, 10)
  } else if (!dateIso && typeof sd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sd)) {
    dateIso = sd.slice(0, 10)
  } else if (!dateIso && sd != null) {
    dateIso = String(sd).slice(0, 10)
  }

  return {
    id: String(session.id),
    leagueId: String(session.league_id ?? session.leagueId ?? ''),
    leagueName: session.league_name ?? session.leagueName ?? '',
    title: session.title,
    dateIso,
    time24,
    date: session.date && !/^\d{4}-\d{2}-\d{2}/.test(String(session.date))
      ? session.date
      : formatDateFromIso(dateIso),
    time: session.time && !/^\d{2}:\d{2}/.test(String(session.time))
      ? session.time
      : formatTimeDisplay(time24),
    status: session.status || 'open',
    stats_finalized: Boolean(session.stats_finalized) || Number(session.stats_finalized) === 1,
    stats_finalized_at: session.stats_finalized_at ?? null,
    maxPlayers: Number(session.maxPlayers) || 10,
    players: session.players ?? [],
    playerIds: session.playerIds ?? [],
  }
}

export async function fetchSessionRosterMeta(sessionId, fallbackMaxPlayers = 10) {
  const sid = Number.parseInt(String(sessionId), 10)
  if (Number.isNaN(sid)) {
    return { playerIds: [], rosterCount: 0, maxPlayers: fallbackMaxPlayers }
  }
  try {
    const res = await apiFetch(`/api/sessions/${sid}`, { cache: 'no-store' })
    const data = res?.data
    const rows = Array.isArray(data?.players) ? data.players : []
    const playerIds = rows
      .map((row) => (row?.user_id != null ? String(row.user_id) : row?.id != null ? String(row.id) : null))
      .filter(Boolean)
    return {
      playerIds,
      rosterCount: playerIds.length,
      maxPlayers: fallbackMaxPlayers,
    }
  } catch {
    return { playerIds: [], rosterCount: 0, maxPlayers: fallbackMaxPlayers }
  }
}

export function mergeSessionRosterMeta(session, rosterMeta) {
  const meta = rosterMeta[String(session.id)]
  if (!meta) return session
  return {
    ...session,
    players: meta.playerIds,
    playerIds: meta.playerIds,
    rosterCount: meta.rosterCount,
    maxPlayers: meta.maxPlayers ?? session.maxPlayers,
  }
}

export async function fetchRosterMetaForSessions(sessionRows, fallbackMaxPlayers = 10) {
  if (!sessionRows.length) return {}
  const entries = await Promise.all(
    sessionRows.map(async (session) => {
      const meta = await fetchSessionRosterMeta(session.id, fallbackMaxPlayers)
      return [String(session.id), meta]
    }),
  )
  return Object.fromEntries(entries)
}
