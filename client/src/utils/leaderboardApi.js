import { apiFetch } from './apiFetch'

export function parseDbUserId(raw) {
  const uid = Number.parseInt(String(raw ?? ''), 10)
  if (Number.isNaN(uid) || String(uid) !== String(raw ?? '')) return null
  return uid
}

export function parseLeagueId(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const trimmed = String(raw).trim()
  if (!/^\d+$/.test(trimmed)) return null
  const id = Number.parseInt(trimmed, 10)
  return Number.isNaN(id) ? null : id
}

function pickLeagueRow(rows, preferLeagueId) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return null
  const preferred = parseLeagueId(preferLeagueId)
  if (preferred != null) {
    const hit = list.find((row) => Number(row.id) === preferred)
    if (hit) return hit
  }
  return list[0]
}

/** Resolve league id: prefer active league from app state, then /api/leagues/mine. */
export async function resolveLeagueIdForLeaderboard({ activeLeagueId, userId }) {
  const direct = parseLeagueId(activeLeagueId)
  if (direct != null) return direct

  const uid = parseDbUserId(userId)
  if (uid == null) return null

  try {
    const mine = await apiFetch(`/api/leagues/mine?userId=${uid}`)
    const rows = Array.isArray(mine?.data) ? mine.data : []
    const picked = pickLeagueRow(rows, activeLeagueId)
    if (picked?.id == null) return null
    return parseLeagueId(picked.id)
  } catch {
    return null
  }
}

/** Raw API response: { data: { league_id, league_name, players, count } } */
export async function getLeagueLeaderboard(leagueId) {
  const id = parseLeagueId(leagueId)
  if (id == null) {
    throw new Error('Invalid league id')
  }
  return apiFetch(`/api/leagues/${id}/leaderboard`)
}

/** Raw API response: { data: { league_id, league_name, players, count } } */
export async function getGlobalLeaderboard() {
  return apiFetch('/api/players/leaderboard')
}

export async function fetchLeaderboardFromApi({ activeLeagueId, userId }) {
  const leagueId = await resolveLeagueIdForLeaderboard({ activeLeagueId, userId })

  if (leagueId != null) {
    return getLeagueLeaderboard(leagueId)
  }

  return getGlobalLeaderboard()
}

export function resolveDisplayRating(_matchesPlayed, rating) {
  const value = Number(rating)
  return Number.isFinite(value) ? value : 6.0
}

export function mapApiLeaderboardPlayer(row) {
  const matchesPlayed = Number(row.matches_played) || 0
  const rating = resolveDisplayRating(matchesPlayed, row.rating)
  return {
    id: row.user_id,
    name: row.display_name || row.username || 'Player',
    matchesPlayed,
    rating,
    ovr: Number(row.ovr) || Math.round(rating * 10),
    playerWorth: Number(row.player_worth) || 10,
    goals: Number(row.goals) || 0,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    mvp: Number(row.mvp_count ?? row.mvp_trophies) || 0,
    isActive: row.is_active !== false,
  }
}
