import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { autoBalanceTeams } from '../utils/draftUtils'
import { formatDateFromIso, formatTimeDisplay } from '../utils/sessionDisplay'
import { sessionRosterIds } from '../utils/sessionRoster'
import { apiFetch } from '../utils/apiFetch'

const users = []
const initialLeagueMembers = []
const initialLeagues = []
const initialMatches = []
const initialPlayers = []
const initialSessions = []
const initialSubmittedStats = []
const initialTeams = [
  { id: 'team-a', name: 'Team A' },
  { id: 'team-b', name: 'Team B' },
  { id: 'team-c', name: 'Team C' },
]

function parseDbUserId(currentUserId) {
  if (currentUserId == null) return null
  const uid = Number.parseInt(String(currentUserId), 10)
  if (Number.isNaN(uid) || String(uid) !== String(currentUserId)) return null
  return uid
}

function mapApiSessionRowToClient(s) {
  const timeRaw = s.session_time != null ? String(s.session_time) : ''
  const timeShort = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw
  const time24 = /^\d{2}:\d{2}$/.test(timeShort) ? timeShort : '12:00'
  let dateIso = ''
  const sd = s.session_date
  if (sd instanceof Date && !Number.isNaN(sd.getTime())) {
    dateIso = sd.toISOString().slice(0, 10)
  } else if (typeof sd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sd)) {
    dateIso = sd.slice(0, 10)
  } else if (sd != null) {
    dateIso = String(sd).slice(0, 10)
  }
  return {
    id: String(s.id),
    leagueId: String(s.league_id),
    leagueName: s.league_name ?? 'League',
    title: s.title,
    dateIso,
    time24,
    date: formatDateFromIso(dateIso),
    time: formatTimeDisplay(time24),
    location: s.location ?? '',
    format: s.format ?? '5v5',
    budgetPerTeam: Number(s.budget_per_team) || 50,
    maxPlayers: 10,
    players: [],
    status: s.status || 'open',
  }
}

const MockAppContext = createContext(null)

const SESSIONS_STORAGE_KEY = 'side5-sessions'
const LEAGUES_STORAGE_KEY = 'side5-leagues'
const ACTIVE_LEAGUE_STORAGE_KEY = 'side5-active-league-id'
const LEAGUE_MEMBERS_STORAGE_KEY = 'side5-league-members'
const CURRENT_USER_STORAGE_KEY = 'side5-current-user-id'
const AUTH_USERS_STORAGE_KEY = 'side5-auth-users'
const STAT_SUBMISSIONS_STORAGE_KEY = 'side5-stat-submissions'
const REVIEW_ASSIGNMENTS_STORAGE_KEY = 'side5-review-assignments'
const PLAYER_REVIEWS_STORAGE_KEY = 'side5-player-reviews'
const MVP_VOTES_STORAGE_KEY = 'side5-mvp-votes'
const DATA_VERSION_STORAGE_KEY = 'side5-data-version'
const DATA_VERSION = '2026-04-mock-reset'
const DEFAULT_LEAGUE_RATING = 6
const DEFAULT_LEAGUE_VALUE = 10

function ensureDataVersion() {
  if (typeof window === 'undefined') return
  try {
    const current = window.localStorage.getItem(DATA_VERSION_STORAGE_KEY)
    if (current === DATA_VERSION) return
    window.localStorage.removeItem(SESSIONS_STORAGE_KEY)
    window.localStorage.removeItem(LEAGUES_STORAGE_KEY)
    window.localStorage.removeItem(ACTIVE_LEAGUE_STORAGE_KEY)
    window.localStorage.removeItem(LEAGUE_MEMBERS_STORAGE_KEY)
    window.localStorage.removeItem(STAT_SUBMISSIONS_STORAGE_KEY)
    window.localStorage.removeItem(REVIEW_ASSIGNMENTS_STORAGE_KEY)
    window.localStorage.removeItem(PLAYER_REVIEWS_STORAGE_KEY)
    window.localStorage.removeItem(MVP_VOTES_STORAGE_KEY)
    window.localStorage.setItem(DATA_VERSION_STORAGE_KEY, DATA_VERSION)
  } catch {
    /* ignore */
  }
}

function readStoredSessions() {
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeStoredSession) : null
  } catch {
    return null
  }
}

function normalizeStoredSession(raw) {
  const roster = Array.isArray(raw.players) && raw.players.length ? raw.players : raw.playerIds ?? []
  return {
    ...raw,
    players: roster,
    leagueId: raw.leagueId ?? 'l1',
    leagueName: raw.leagueName ?? 'Monday Ballers',
  }
}

function readStoredLeagues() {
  try {
    const raw = window.localStorage.getItem(LEAGUES_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readStoredLeagueMembers() {
  try {
    const raw = window.localStorage.getItem(LEAGUE_MEMBERS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readActiveLeagueId() {
  try {
    return window.localStorage.getItem(ACTIVE_LEAGUE_STORAGE_KEY)
  } catch {
    return null
  }
}

function readCurrentUserId() {
  try {
    const legacyId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
    if (legacyId) return legacyId
    const currentUserRaw = window.localStorage.getItem('currentUser')
    if (!currentUserRaw) return null
    const parsed = JSON.parse(currentUserRaw)
    return parsed?.id ? String(parsed.id) : null
  } catch {
    return null
  }
}

function readStoredAuthUsers() {
  try {
    const raw = window.localStorage.getItem(AUTH_USERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function resolveInitialActiveLeagueId(userId, members) {
  if (!userId) return null
  const mine = members.filter((m) => m.userId === userId)
  if (!mine.length) return null
  const stored = readActiveLeagueId()
  if (stored && mine.some((m) => m.leagueId === stored)) return stored
  return mine[0].leagueId
}

function cloneTeamsForSession(sessionId) {
  return initialTeams.map((team) => ({
    ...team,
    id: `${sessionId}-${team.id}`,
    playerIds: [],
    budgetUsed: 0,
  }))
}

function randomInviteSuffix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 3; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function readStoredArray(key) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function hashSeed(input) {
  const str = String(input ?? '')
  let hash = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

function makeSeededRandom(seedInput) {
  let seed = hashSeed(seedInput) || 1
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

function seededShuffle(list, seedInput) {
  const out = [...list]
  const rand = makeSeededRandom(seedInput)
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const temp = out[i]
    out[i] = out[j]
    out[j] = temp
  }
  return out
}

const ATTRIBUTE_TO_ARCHETYPES = {
  Fast: ['Flash', 'Fenomeno'],
  Intelligent: ['Maestro', 'Magician'],
  Sniper: ['Killer', 'Fenomeno'],
  Strong: ['Tank', 'Wall'],
  Skilled: ['Magician', 'Fenomeno'],
  Creative: ['Magician', 'Maestro'],
  Defensive: ['Wall', 'Tank'],
  Clutch: ['Killer', 'Magician'],
  Leader: ['Engine', 'Maestro'],
  Aggressive: ['Tank', 'Engine'],
  Stamina: ['Engine', 'Flash'],
  Passer: ['Maestro', 'Magician'],
  Dribbler: ['Fenomeno', 'Magician'],
  Positioning: ['Wall', 'Maestro'],
}

const ALL_ARCHETYPES = ['Magician', 'Fenomeno', 'Killer', 'Tank', 'Engine', 'Maestro', 'Wall', 'Flash']
const ALL_ATTRIBUTES = [
  'Fast',
  'Intelligent',
  'Sniper',
  'Strong',
  'Skilled',
  'Creative',
  'Defensive',
  'Clutch',
  'Leader',
  'Aggressive',
  'Stamina',
  'Passer',
  'Dribbler',
  'Positioning',
]

function normalizeUserShape(rawUser) {
  if (!rawUser || rawUser.id == null) return null
  const displayName =
    rawUser.displayName ||
    rawUser.display_name ||
    rawUser.fullName ||
    rawUser.name ||
    rawUser.full_name ||
    rawUser.username ||
    rawUser.email ||
    'Player'
  const usernameCandidate =
    rawUser.username ||
    (typeof rawUser.email === 'string' ? rawUser.email.split('@')[0] : '') ||
    String(displayName).toLowerCase().replace(/\s+/g, '')
  const initials =
    rawUser.initials ||
    String(displayName)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') ||
    String(usernameCandidate).slice(0, 2).toUpperCase()

  const idStr = String(rawUser.id ?? '')
  const parsedNumericId = Number.parseInt(idStr, 10)
  const playerIdFromUserRow =
    rawUser.playerId ??
    rawUser.player_id ??
    (!Number.isNaN(parsedNumericId) && String(parsedNumericId) === idStr ? String(parsedNumericId) : null)

  return {
    ...rawUser,
    id: String(rawUser.id),
    username: String(usernameCandidate || 'player').toLowerCase(),
    displayName: String(displayName),
    initials,
    playerId: playerIdFromUserRow,
    email: rawUser.email ?? '',
    phone: rawUser.phone ?? '',
    avatarImage: rawUser.avatarImage ?? rawUser.avatar_image ?? '',
    memberSince:
      rawUser.memberSince ??
      rawUser.member_since ??
      new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
}

export function MockAppProvider({ children }) {
  ensureDataVersion()
  const storedMembersOnce = readStoredLeagueMembers()
  const membersSeed = storedMembersOnce === null ? [...initialLeagueMembers] : storedMembersOnce

  const [currentUserId, setCurrentUserIdState] = useState(() => readCurrentUserId())
  const [authUsers, setAuthUsers] = useState(() => readStoredAuthUsers())
  const [players, setPlayers] = useState(initialPlayers)
  const [leagueMembers, setLeagueMembers] = useState(membersSeed)
  const [leagues, setLeagues] = useState(() => readStoredLeagues() ?? initialLeagues)
  const [activeLeagueId, setActiveLeagueIdState] = useState(() =>
    resolveInitialActiveLeagueId(readCurrentUserId(), membersSeed),
  )
  const [sessions, setSessions] = useState(() => readStoredSessions() ?? initialSessions.map(normalizeStoredSession))
  const [matches] = useState(initialMatches)
  const [statSubmissions, setStatSubmissions] = useState(() => {
    const parsed = readStoredArray(STAT_SUBMISSIONS_STORAGE_KEY)
    if (!parsed.length) return initialSubmittedStats
    return parsed.map((row) => ({
      ...row,
      leagueId: row.leagueId ?? initialMatches.find((m) => m.id === row.matchId)?.leagueId ?? null,
      sessionId: row.sessionId ?? initialMatches.find((m) => m.id === row.matchId)?.sessionId ?? null,
      captainComment: row.captainComment ?? null,
    }))
  })
  const [reviewAssignments, setReviewAssignments] = useState(() => readStoredArray(REVIEW_ASSIGNMENTS_STORAGE_KEY))
  const [playerReviews, setPlayerReviews] = useState(() => readStoredArray(PLAYER_REVIEWS_STORAGE_KEY))
  const [mvpVotes, setMvpVotes] = useState(() => readStoredArray(MVP_VOTES_STORAGE_KEY))
  const [sessionTeams, setSessionTeams] = useState(() => {
    const list = readStoredSessions() ?? initialSessions.map(normalizeStoredSession)
    return list.reduce((acc, session) => {
      acc[session.id] = cloneTeamsForSession(session.id)
      return acc
    }, {})
  })

  const currentUser = useMemo(
    () => {
      if (!currentUserId) return null
      const fromMemory =
        authUsers.find((u) => String(u.id) === String(currentUserId)) ??
        users.find((u) => String(u.id) === String(currentUserId)) ??
        null
      if (fromMemory) return normalizeUserShape(fromMemory)
      try {
        const raw = window.localStorage.getItem('currentUser')
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && String(parsed.id) === String(currentUserId) ? normalizeUserShape(parsed) : null
      } catch {
        return null
      }
    },
    [currentUserId, authUsers],
  )

  const getLeagueMemberPlayerIds = useCallback(
    (leagueId) => {
      const ids = []
      const seen = new Set()
      leagueMembers
        .filter((lm) => lm.leagueId === leagueId)
        .forEach((lm) => {
          const u = users.find((x) => x.id === lm.userId)
          if (u?.playerId && !seen.has(u.playerId)) {
            seen.add(u.playerId)
            ids.push(u.playerId)
          }
        })
      return ids
    },
    [leagueMembers],
  )

  const getLeagueMemberRole = useCallback(
    (leagueId, userId) =>
      leagueMembers.find(
        (lm) => String(lm.leagueId) === String(leagueId) && String(lm.userId) === String(userId),
      )?.role ?? null,
    [leagueMembers],
  )

  const canManageLeague = useCallback(
    (leagueId) => {
      if (!currentUserId || !leagueId) return false
      const role = getLeagueMemberRole(leagueId, currentUserId)
      return role === 'owner' || role === 'manager'
    },
    [currentUserId, getLeagueMemberRole],
  )

  const isLeagueOwner = useCallback(
    (leagueId) => getLeagueMemberRole(leagueId, currentUserId) === 'owner',
    [currentUserId, getLeagueMemberRole],
  )

  const canManageSession = useCallback(
    (sessionId) => {
      const session = sessions.find((s) => String(s.id) === String(sessionId))
      if (!session) return false
      return canManageLeague(session.leagueId)
    },
    [sessions, canManageLeague],
  )

  const isCurrentUserSessionCaptain = useCallback(
    (sessionId) => {
      if (!currentUserId) return false
      const teams = sessionTeams[String(sessionId)] ?? sessionTeams[sessionId] ?? []
      return teams.some((team) => {
        if (team?.captainUserId != null && String(team.captainUserId) === String(currentUserId)) return true
        if (team?.captain_user_id != null && String(team.captain_user_id) === String(currentUserId)) return true
        if (currentUser?.playerId != null && team?.captainId != null && String(team.captainId) === String(currentUser.playerId)) {
          return true
        }
        return false
      })
    },
    [currentUserId, currentUser?.playerId, sessionTeams],
  )

  const canApproveStatsForMatch = useCallback(
    (matchId) => {
      if (!currentUserId) return false
      const match = matches.find((m) => m.id === matchId)
      if (!match) return false
      const session = sessions.find((s) => s.id === match.sessionId)
      if (!session) return false
      const role = getLeagueMemberRole(session.leagueId, currentUserId)
      if (role === 'owner' || role === 'manager') return true
      const me = users.find((u) => u.id === currentUserId)
      if (!me?.playerId) return false
      const teamsList = sessionTeams[session.id] ?? []
      const captainIds = teamsList.map((t) => t.captainId).filter(Boolean)
      return captainIds.includes(me.playerId)
    },
    [currentUserId, sessions, sessionTeams, matches, getLeagueMemberRole],
  )

  const getLeaguePlayers = useCallback(
    (leagueId) => {
      if (!leagueId) return []
      const memberPlayerIds = new Set(getLeagueMemberPlayerIds(leagueId))
      const approved = statSubmissions.filter((row) => row.status === 'approved' && row.leagueId === leagueId)
      const leagueReviews = playerReviews.filter((row) => row.leagueId === leagueId)
      const mvpWinnerByMatch = new Map()
      mvpVotes
        .filter((vote) => vote.leagueId === leagueId)
        .forEach((vote) => {
          const key = `${vote.matchId}:${vote.mvpVotePlayerId}`
          const count = mvpWinnerByMatch.get(key) ?? 0
          mvpWinnerByMatch.set(key, count + 1)
        })
      const matchWinners = new Map()
      mvpWinnerByMatch.forEach((votes, key) => {
        const [matchId, playerId] = key.split(':')
        const current = matchWinners.get(matchId)
        if (!current || votes > current.votes || (votes === current.votes && String(playerId) < String(current.playerId))) {
          matchWinners.set(matchId, { playerId, votes })
        }
      })

      const aggregate = new Map()
      approved.forEach((row) => {
        const curr = aggregate.get(row.playerId) ?? { games: 0, goals: 0, assists: 0, saves: 0, mvps: 0, wins: 0 }
        curr.games += 1
        curr.goals += Number(row.goals) || 0
        curr.wins += row.result === 'won' ? 1 : 0
        aggregate.set(row.playerId, curr)
      })

      matchWinners.forEach((winner) => {
        const curr = aggregate.get(winner.playerId) ?? { games: 0, goals: 0, assists: 0, saves: 0, mvps: 0, wins: 0 }
        curr.mvps += 1
        aggregate.set(winner.playerId, curr)
      })

      const reviewAgg = new Map()
      leagueReviews.forEach((review) => {
        const curr = reviewAgg.get(review.reviewedPlayerId) ?? { total: 0, count: 0 }
        curr.total += Number(review.performanceScore) || 0
        curr.count += 1
        reviewAgg.set(review.reviewedPlayerId, curr)
      })

      const rawByPlayerId = new Map()
      memberPlayerIds.forEach((playerId) => {
        const base = players.find((p) => p.id === playerId)
        if (!base) return
        const agg = aggregate.get(playerId) ?? { games: 0, goals: 0, assists: 0, saves: 0, mvps: 0, wins: 0 }
        const reviewsForPlayer = reviewAgg.get(playerId) ?? { total: 0, count: 0 }
        const avgReviewScore = reviewsForPlayer.count ? reviewsForPlayer.total / reviewsForPlayer.count : 70
        const overall = clamp(avgReviewScore + agg.goals * 0.6 + agg.wins * 0.4 + agg.mvps * 1.1, 60, 98)
        const hasStats = agg.games > 0 || reviewsForPlayer.count > 0
        const rating = overall / 10
        const value = clamp(rating * 1.35, 6, 25)
        const winRate = agg.games > 0 ? Math.round((agg.wins / agg.games) * 100) : 0
        rawByPlayerId.set(playerId, {
          ...base,
          ...agg,
          winRate,
          overall,
          rating,
          value,
        })
      })

      const withStats = Array.from(rawByPlayerId.values()).filter((row) => row.rating != null && row.value != null)
      const avgRating = withStats.length
        ? withStats.reduce((sum, row) => sum + row.rating, 0) / withStats.length
        : DEFAULT_LEAGUE_RATING
      const avgValue = withStats.length
        ? withStats.reduce((sum, row) => sum + row.value, 0) / withStats.length
        : DEFAULT_LEAGUE_VALUE

      return Array.from(rawByPlayerId.values()).map((row) => ({
        ...row,
        rating: row.rating ?? avgRating,
        value: row.value ?? avgValue,
      }))
    },
    [getLeagueMemberPlayerIds, players, statSubmissions, playerReviews, mvpVotes],
  )

  const setActiveLeagueId = useCallback((id) => {
    const next = id ?? null
    setActiveLeagueIdState(next)
    try {
      if (next) window.localStorage.setItem(ACTIVE_LEAGUE_STORAGE_KEY, next)
      else window.localStorage.removeItem(ACTIVE_LEAGUE_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const persistLeagues = (updater) => {
    setLeagues((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        window.localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const persistLeagueMembers = (updater) => {
    setLeagueMembers((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        window.localStorage.setItem(LEAGUE_MEMBERS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const persistSessions = (updater) => {
    setSessions((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  /** Replace league + membership state from DB (numeric user ids only). */
  const applyDatabaseLeaguesToState = (uid, rows) => {
    const leaguesMapped = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      description: r.description || 'No description yet.',
      inviteCode: r.invite_code,
      memberCount: Number(r.member_count) || 0,
      sessionCount: Number(r.session_count) || 0,
      nextSessionId: null,
      defaultFormat: '5v5',
    }))
    const userIdStr = String(uid)
    const membersMapped = rows.map((r) => ({
      id: `lm-api-${r.id}-${userIdStr}`,
      leagueId: String(r.id),
      userId: userIdStr,
      role: r.my_role,
      joinedAt: r.joined_at ? new Date(r.joined_at).getTime() : Date.now(),
    }))
    persistLeagues(() => leaguesMapped)
    persistLeagueMembers(() => membersMapped)
    const stored = readActiveLeagueId()
    const ids = leaguesMapped.map((l) => l.id)
    const nextActive = stored && ids.includes(stored) ? stored : (ids[0] ?? null)
    setActiveLeagueId(nextActive ?? null)
    return leaguesMapped
  }

  const refreshLeaguesFromApi = useCallback(async () => {
    if (!currentUserId) return null
    const uid = Number.parseInt(String(currentUserId), 10)
    if (Number.isNaN(uid) || String(uid) !== String(currentUserId)) return null
    try {
      const result = await apiFetch(`/api/leagues/mine?userId=${uid}`)
      const rows = Array.isArray(result?.data) ? result.data : []
      return applyDatabaseLeaguesToState(uid, rows)
    } catch {
      /* offline or server down — keep existing local state */
      return null
    }
  }, [currentUserId])

  const refreshSessionsFromApi = useCallback(async () => {
    const uid = parseDbUserId(currentUserId)
    if (uid == null) return null
    try {
      const [mineRes, sessRes] = await Promise.all([
        apiFetch(`/api/leagues/mine?userId=${uid}`),
        apiFetch('/api/sessions'),
      ])
      const mineRows = Array.isArray(mineRes?.data) ? mineRes.data : []
      const idSet = new Set(mineRows.map((r) => Number(r.id)))
      const rows = Array.isArray(sessRes?.data) ? sessRes.data : []
      const mapped = rows.filter((s) => idSet.has(Number(s.league_id))).map(mapApiSessionRowToClient)
      const teamEntries = await Promise.all(
        mapped.map(async (session) => {
          const sid = Number.parseInt(String(session.id), 10)
          if (Number.isNaN(sid)) return [session.id, null]
          try {
            const teamsRes = await apiFetch(`/api/sessions/${sid}/teams`, { cache: 'no-store' })
            const rows = Array.isArray(teamsRes?.data) ? teamsRes.data : []
            return [
              session.id,
              rows.map((row) => ({
                id: String(row.id),
                name: row.name,
                captainUserId: row.captain_user_id != null ? String(row.captain_user_id) : null,
                captainId: row.captain_user_id != null ? String(row.captain_user_id) : null,
                playerIds: [],
                budgetUsed: 0,
              })),
            ]
          } catch {
            return [session.id, null]
          }
        }),
      )
      persistSessions(() => mapped)
      setSessionTeams((prev) => {
        const next = { ...prev }
        teamEntries.forEach(([sessionId, teams]) => {
          if (Array.isArray(teams)) next[String(sessionId)] = teams
        })
        return next
      })
      return mapped
    } catch {
      return null
    }
  }, [currentUserId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await refreshLeaguesFromApi()
      if (!cancelled) await refreshSessionsFromApi()
    })()
    return () => {
      cancelled = true
    }
  }, [currentUserId, refreshLeaguesFromApi, refreshSessionsFromApi])

  useEffect(() => {
    setSessionTeams((teams) => {
      const merged = { ...teams }
      let changed = false
      sessions.forEach((session) => {
        if (!merged[session.id]) {
          merged[session.id] = cloneTeamsForSession(session.id)
          changed = true
        }
      })
      return changed ? merged : teams
    })
  }, [sessions])

  const leagueRollups = useMemo(() => {
    const map = {}
    leagues.forEach((league) => {
      const leagueSessions = sessions.filter((s) => String(s.leagueId) === String(league.id))
      const memberPlayerCount = getLeagueMemberPlayerIds(league.id).length
      const upcoming = [...leagueSessions]
        .filter((s) => s.status !== 'completed')
        .sort((a, b) => `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`))
      const apiMembers = Number(league.memberCount) || 0
      const apiSessions = Number(league.sessionCount) || 0
      map[league.id] = {
        sessionCount: Math.max(leagueSessions.length, apiSessions),
        memberCount: Math.max(memberPlayerCount, apiMembers),
        nextSessionId: upcoming[0]?.id ?? null,
      }
    })
    return map
  }, [leagues, sessions, getLeagueMemberPlayerIds])

  const leaguesDisplay = useMemo(
    () => leagues.map((l) => ({ ...l, ...leagueRollups[l.id] })),
    [leagues, leagueRollups],
  )

  const activeLeague = useMemo(() => {
    if (!activeLeagueId) return null
    return leaguesDisplay.find((l) => String(l.id) === String(activeLeagueId)) ?? null
  }, [leaguesDisplay, activeLeagueId])

  const myLeagueIds = useMemo(() => {
    if (!currentUserId) return []
    return leagueMembers
      .filter((lm) => String(lm.userId) === String(currentUserId))
      .map((lm) => lm.leagueId)
  }, [currentUserId, leagueMembers])

  const logout = useCallback(() => {
    setCurrentUserIdState(null)
    setActiveLeagueId(null)
    try {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
      window.localStorage.removeItem('currentUser')
    } catch {
      /* ignore */
    }
  }, [setActiveLeagueId])

  const setAuthenticatedUser = useCallback(
    (user) => {
      const normalizedUser = normalizeUserShape(user)
      if (!normalizedUser?.id) return
      const normalizedId = normalizedUser.id
      setCurrentUserIdState(normalizedId)
      setAuthUsers((current) => {
        const exists = current.some((row) => String(row.id) === normalizedId)
        const next = exists
          ? current.map((row) => (String(row.id) === normalizedId ? { ...row, ...normalizedUser } : row))
          : [...current, normalizedUser]
        try {
          window.localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
      try {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, normalizedId)
        window.localStorage.setItem('currentUser', JSON.stringify(normalizedUser))
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const updateCurrentUserProfileImage = useCallback(
    async (avatarImage) => {
      if (!currentUserId) return { ok: false, reason: 'No active user.' }
      const nextAvatar = typeof avatarImage === 'string' ? avatarImage : ''
      const numericUserId = Number.parseInt(String(currentUserId), 10)
      const isDbUser = !Number.isNaN(numericUserId) && String(numericUserId) === String(currentUserId)

      if (isDbUser) {
        try {
          await apiFetch(`/api/players/${numericUserId}/avatar`, {
            method: 'PATCH',
            body: JSON.stringify({ avatarImage: nextAvatar }),
          })
        } catch (error) {
          return { ok: false, reason: error?.message || 'Could not update profile image.' }
        }
      }

      setAuthUsers((current) => {
        const exists = current.some((row) => String(row.id) === String(currentUserId))
        const next = exists
          ? current.map((row) => (String(row.id) === String(currentUserId) ? { ...row, avatarImage: nextAvatar } : row))
          : currentUser
            ? [...current, { ...currentUser, avatarImage: nextAvatar }]
            : current
        try {
          window.localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })

      try {
        const raw = window.localStorage.getItem('currentUser')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && String(parsed.id) === String(currentUserId)) {
            window.localStorage.setItem('currentUser', JSON.stringify({ ...parsed, avatarImage: nextAvatar }))
          }
        }
      } catch {
        /* ignore */
      }

      return { ok: true }
    },
    [currentUserId, currentUser],
  )

  const confirmAttendance = (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      return
    }

    const roster = new Set(sessionRosterIds(session))
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        roster.has(player.id) && player.status !== 'confirmed' ? { ...player, status: 'confirmed' } : player,
      ),
    )
  }

  const persistSubmissions = (nextSubmissions) => {
    setStatSubmissions(nextSubmissions)
    try {
      window.localStorage.setItem(STAT_SUBMISSIONS_STORAGE_KEY, JSON.stringify(nextSubmissions))
    } catch {
      /* ignore */
    }
  }

  const persistReviewAssignments = (nextAssignments) => {
    setReviewAssignments(nextAssignments)
    try {
      window.localStorage.setItem(REVIEW_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(nextAssignments))
    } catch {
      /* ignore */
    }
  }

  const persistPlayerReviews = (nextReviews) => {
    setPlayerReviews(nextReviews)
    try {
      window.localStorage.setItem(PLAYER_REVIEWS_STORAGE_KEY, JSON.stringify(nextReviews))
    } catch {
      /* ignore */
    }
  }

  const persistMvpVotes = (nextVotes) => {
    setMvpVotes(nextVotes)
    try {
      window.localStorage.setItem(MVP_VOTES_STORAGE_KEY, JSON.stringify(nextVotes))
    } catch {
      /* ignore */
    }
  }

  const getMatchContext = useCallback(
    (matchId) => {
      const match = matches.find((m) => m.id === matchId) ?? null
      const session = sessions.find((s) => s.id === match?.sessionId) ?? sessions.find((s) => s.id === matchId) ?? null
      const leagueId = match?.leagueId ?? session?.leagueId ?? null
      const sessionId = match?.sessionId ?? session?.id ?? null
      const teams = sessionId ? sessionTeams[sessionId] ?? [] : []
      const rosterPlayerIds = Array.from(new Set(teams.flatMap((team) => team.playerIds || [])))
      return { match, session, leagueId, sessionId, teams, rosterPlayerIds }
    },
    [matches, sessions, sessionTeams],
  )

  const getCurrentUserPlayerId = useCallback(() => {
    return currentUser?.playerId ?? null
  }, [currentUser])

  const getMyStatSubmissionForMatch = useCallback(
    (matchId) => {
      const me = getCurrentUserPlayerId()
      if (!me) return null
      const mine = statSubmissions
        .filter((row) => row.matchId === matchId && row.playerId === me)
        .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0))
      return mine[0] ?? null
    },
    [getCurrentUserPlayerId, statSubmissions],
  )

  const addPlayerToTeam = (sessionId, teamId, playerId) => {
    if (!canManageSession(sessionId) && !isCurrentUserSessionCaptain(sessionId)) {
      return { ok: false, reason: 'Only league owners, managers, or session captains can draft players.' }
    }
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Session not found' }
    }

    const leaguePlayers = getLeaguePlayers(session.leagueId)
    const player = leaguePlayers.find((item) => item.id === playerId) ?? players.find((item) => item.id === playerId)
    if (!player) {
      return { ok: false, reason: 'Player not found' }
    }

    const activeTeams = sessionTeams[sessionId] ?? []
    const team = activeTeams.find((item) => item.id === teamId)
    if (!team) {
      return { ok: false, reason: 'Team not found' }
    }

    const alreadyDrafted = activeTeams.some((item) => item.playerIds.includes(playerId))
    if (alreadyDrafted) {
      return { ok: false, reason: 'Player already drafted' }
    }

    if (team.budgetUsed + player.value > session.budgetPerTeam) {
      return { ok: false, reason: 'Budget exceeded' }
    }

    setSessionTeams((currentTeams) => ({
      ...currentTeams,
      [sessionId]: activeTeams.map((item) =>
        item.id === teamId
          ? {
              ...item,
              playerIds: [...item.playerIds, playerId],
              budgetUsed: Number((item.budgetUsed + player.value).toFixed(1)),
            }
          : item,
      ),
    }))

    return { ok: true }
  }

  const balanceTeams = (sessionId) => {
    if (!canManageSession(sessionId) && !isCurrentUserSessionCaptain(sessionId)) {
      return { ok: false, reason: 'Only league owners, managers, or session captains can balance teams.' }
    }
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Session not found' }
    }

    const roster = new Set(sessionRosterIds(session))
    const leaguePlayers = getLeaguePlayers(session.leagueId)
    const draftPool = leaguePlayers.filter((player) => roster.has(player.id))
    const currentTeamList = sessionTeams[sessionId] ?? cloneTeamsForSession(sessionId)
    const nTeams = Math.max(2, currentTeamList.length)
    const balancedTeams = autoBalanceTeams(draftPool, nTeams, session.budgetPerTeam)

    setSessionTeams((currentTeams) => ({
      ...currentTeams,
      [sessionId]: balancedTeams.map((team, index) => ({
        ...(currentTeams[sessionId]?.[index] ?? cloneTeamsForSession(sessionId)[index]),
        playerIds: team.playerIds,
        budgetUsed: team.budgetUsed,
      })),
    }))

    return { ok: true }
  }

  const lockTeams = (sessionId) => {
    if (!canManageSession(sessionId) && !isCurrentUserSessionCaptain(sessionId)) {
      return { ok: false, reason: 'Only league owners, managers, or session captains can lock teams.' }
    }
    persistSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === sessionId ? { ...session, status: 'locked' } : session)),
    )
    return { ok: true }
  }

  const submitStats = ({ matchId, goals, result }) => {
    const me = currentUser?.playerId
    if (!me) {
      return { ok: false, reason: 'Log in to submit stats.' }
    }
    const context = getMatchContext(matchId)
    const team = context.teams.find((item) => Array.isArray(item.playerIds) && item.playerIds.includes(me))
    const existing = statSubmissions
      .filter((row) => row.matchId === matchId && row.playerId === me)
      .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0))[0]
    if (existing?.status === 'pending') {
      return { ok: false, reason: 'You already submitted stats. Pending captain review.' }
    }
    if (existing?.status === 'approved') {
      return { ok: false, reason: 'Your stats are already approved for this match.' }
    }
    const baseSubmission = {
      id: existing?.id ?? `sub-${Date.now()}`,
      matchId,
      sessionId: context.sessionId,
      leagueId: context.leagueId,
      teamId: team?.id ?? null,
      playerId: me,
      userId: currentUser.id,
      goals: Math.max(0, Number(goals) || 0),
      result,
      status: 'pending',
      captainComment: null,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    }
    const withoutMine = statSubmissions.filter((row) => row.id !== baseSubmission.id)
    const nextSubmissions = [baseSubmission, ...withoutMine]
    persistSubmissions(nextSubmissions)
    return { ok: true, submission: baseSubmission }
  }

  const reviewSubmission = (submissionId, status, captainComment = '') => {
    const submission = statSubmissions.find((s) => s.id === submissionId)
    if (!submission || !canApproveStatsForMatch(submission.matchId)) {
      return { ok: false, reason: 'Only team captains or league managers can approve stats.' }
    }
    if (status === 'denied' && !String(captainComment || '').trim()) {
      return { ok: false, reason: 'Captain comment is required when denying a submission.' }
    }
    const nextSubmissions = statSubmissions.map((s) =>
      s.id === submissionId
        ? {
            ...s,
            status,
            captainComment: status === 'denied' ? String(captainComment).trim() : null,
            reviewedByUserId: currentUserId,
            updatedAt: Date.now(),
          }
        : s,
    )
    persistSubmissions(nextSubmissions)
    return { ok: true }
  }

  const getAssignedReviewPlayerIds = useCallback(
    (matchId) => {
      const reviewerUserId = currentUserId
      const reviewerPlayerId = getCurrentUserPlayerId()
      if (!reviewerUserId || !reviewerPlayerId) return []
      const existing = reviewAssignments.find(
        (row) => row.matchId === matchId && String(row.reviewerUserId) === String(reviewerUserId),
      )
      if (existing?.assignedPlayerIds?.length) return existing.assignedPlayerIds
      const context = getMatchContext(matchId)
      const myTeam = context.teams.find((team) => (team.playerIds || []).includes(reviewerPlayerId))
      const oppositeTeamPlayers = context.teams
        .filter((team) => team.id !== myTeam?.id)
        .flatMap((team) => team.playerIds || [])
        .filter((pid) => pid !== reviewerPlayerId)
      const sameTeamPlayers = (myTeam?.playerIds || []).filter((pid) => pid !== reviewerPlayerId)
      const oppositeShuffled = seededShuffle(oppositeTeamPlayers, `${matchId}-${reviewerUserId}-opp`)
      const sameShuffled = seededShuffle(sameTeamPlayers, `${matchId}-${reviewerUserId}-same`)
      const assignedPlayerIds = [...oppositeShuffled, ...sameShuffled].slice(0, 2)
      const row = {
        id: `assign-${matchId}-${reviewerUserId}`,
        matchId,
        sessionId: context.sessionId,
        leagueId: context.leagueId,
        reviewerUserId,
        reviewerPlayerId,
        assignedPlayerIds,
        createdAt: Date.now(),
      }
      persistReviewAssignments([row, ...reviewAssignments.filter((item) => item.id !== row.id)])
      return assignedPlayerIds
    },
    [currentUserId, getCurrentUserPlayerId, reviewAssignments, getMatchContext],
  )

  const submitPlayerReviews = ({ matchId, reviews }) => {
    const reviewerUserId = currentUserId
    const context = getMatchContext(matchId)
    const assigned = getAssignedReviewPlayerIds(matchId)
    if (!reviewerUserId || !assigned.length) {
      return { ok: false, reason: 'No review assignment found for this user.' }
    }
    const cleanReviews = reviews
      .filter((item) => assigned.includes(item.reviewedPlayerId))
      .map((item) => ({
        id: `review-${matchId}-${reviewerUserId}-${item.reviewedPlayerId}`,
        matchId,
        sessionId: context.sessionId,
        leagueId: context.leagueId,
        reviewerUserId,
        reviewedPlayerId: item.reviewedPlayerId,
        selectedAttributes: (item.selectedAttributes || []).slice(0, 3),
        performanceScore: Number(item.performanceScore) || 75,
        createdAt: Date.now(),
      }))
    if (cleanReviews.length !== assigned.length) {
      return { ok: false, reason: 'Please submit both assigned player reviews.' }
    }
    const blacklist = new Set(cleanReviews.map((item) => item.id))
    const next = [...cleanReviews, ...playerReviews.filter((item) => !blacklist.has(item.id))]
    persistPlayerReviews(next)
    return { ok: true }
  }

  const submitMvpVote = ({ matchId, mvpVotePlayerId }) => {
    if (!currentUserId) return { ok: false, reason: 'Log in to vote for MVP.' }
    const context = getMatchContext(matchId)
    if (!context.rosterPlayerIds.includes(mvpVotePlayerId)) {
      return { ok: false, reason: 'Select a valid player from this session.' }
    }
    const vote = {
      id: `mvp-${matchId}-${currentUserId}`,
      matchId,
      sessionId: context.sessionId,
      leagueId: context.leagueId,
      voterUserId: currentUserId,
      mvpVotePlayerId,
      createdAt: Date.now(),
    }
    const next = [vote, ...mvpVotes.filter((item) => item.id !== vote.id)]
    persistMvpVotes(next)
    return { ok: true, vote }
  }

  const getMvpWinnerByMatch = useCallback(
    (matchId) => {
      const votes = mvpVotes.filter((item) => item.matchId === matchId)
      if (!votes.length) return null
      const tally = new Map()
      votes.forEach((vote) => {
        const curr = tally.get(vote.mvpVotePlayerId) ?? 0
        tally.set(vote.mvpVotePlayerId, curr + 1)
      })
      let winner = null
      tally.forEach((count, playerId) => {
        if (!winner || count > winner.count || (count === winner.count && String(playerId) < String(winner.playerId))) {
          winner = { playerId, count }
        }
      })
      return winner
    },
    [mvpVotes],
  )

  const getPlayerIdentity = useCallback(
    (playerId, leagueId = null) => {
      const reviews = playerReviews.filter(
        (row) => row.reviewedPlayerId === playerId && (!leagueId || String(row.leagueId) === String(leagueId)),
      )
      const points = Object.fromEntries(ALL_ARCHETYPES.map((item) => [item, 0]))
      reviews.forEach((review) => {
        ;(review.selectedAttributes || []).forEach((attribute) => {
          const mapped = ATTRIBUTE_TO_ARCHETYPES[attribute] || []
          mapped.forEach((arch) => {
            points[arch] = (points[arch] || 0) + 1
          })
        })
      })
      const totalPoints = Object.values(points).reduce((sum, value) => sum + value, 0)
      const ranked = ALL_ARCHETYPES.map((arch) => ({
        name: arch,
        percentage: totalPoints ? Math.round((points[arch] / totalPoints) * 100) : 0,
      })).sort((a, b) => b.percentage - a.percentage)
      return {
        hasVotes: totalPoints > 0,
        mainArchetype: totalPoints > 0 ? (ranked[0]?.name ?? null) : null,
      }
    },
    [playerReviews],
  )

  const getPlayerAttributeProfile = useCallback(
    (playerId, leagueId = null) => {
      const reviews = playerReviews.filter(
        (row) => row.reviewedPlayerId === playerId && (!leagueId || String(row.leagueId) === String(leagueId)),
      )
      const counts = Object.fromEntries(ALL_ATTRIBUTES.map((item) => [item, 0]))
      reviews.forEach((review) => {
        ;(review.selectedAttributes || []).forEach((attribute) => {
          if (counts[attribute] != null) counts[attribute] += 1
        })
      })
      const maxCount = Math.max(0, ...Object.values(counts))
      return ALL_ATTRIBUTES.map((attribute) => ({
        subject: attribute,
        value: maxCount > 0 ? Math.round((counts[attribute] / maxCount) * 100) : 0,
      }))
    },
    [playerReviews],
  )

  const createSession = async (payload) => {
    const leagueIdRaw = payload.leagueId ?? activeLeagueId
    const leagueId = leagueIdRaw != null && String(leagueIdRaw).trim() !== '' ? String(leagueIdRaw).trim() : null
    if (!leagueId || !canManageLeague(leagueId)) {
      return { ok: false, reason: 'Only league owners and managers can create sessions.', id: null }
    }

    const uid = parseDbUserId(currentUserId)
    const leagueIdNum = Number.parseInt(String(leagueId), 10)
    if (uid != null && !Number.isNaN(leagueIdNum) && String(leagueIdNum) === String(leagueId)) {
      try {
        const result = await apiFetch('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({
            leagueId: leagueIdNum,
            title: String(payload.title || '').trim(),
            sessionDate: payload.dateIso,
            sessionTime: payload.time24,
            location: payload.location ?? null,
            format: payload.format || '5v5',
            budgetPerTeam: Number(payload.budgetPerTeam) || 50,
            status: payload.status || 'open',
            createdByUserId: uid,
            teams: Array.isArray(payload.teams) ? payload.teams : undefined,
          }),
        })
        await refreshSessionsFromApi()
        const newId = result?.data?.id != null ? String(result.data.id) : null
        return { ok: true, id: newId }
      } catch (err) {
        return { ok: false, reason: err?.message || 'Could not create session.', id: null }
      }
    }

    const pool = getLeagueMemberPlayerIds(leagueId)
    const id = `s${Date.now()}`
    const maxPlayers = Math.min(Math.max(4, Number(payload.maxPlayers) || 8), Math.max(4, pool.length))
    const league = leagues.find((l) => String(l.id) === String(leagueId))
    const roster = pool.slice(0, maxPlayers)
    const nextSession = {
      id,
      leagueId,
      leagueName: league?.name ?? 'League',
      title: payload.title.trim(),
      dateIso: payload.dateIso,
      time24: payload.time24,
      date: formatDateFromIso(payload.dateIso),
      time: formatTimeDisplay(payload.time24),
      location: payload.location,
      format: payload.format,
      budgetPerTeam: Number(payload.budgetPerTeam) || 50,
      maxPlayers,
      players: roster,
      status: payload.status || 'draft_pending',
    }

    persistSessions((currentSessions) => [nextSession, ...currentSessions])

    const teamsPayload =
      Array.isArray(payload.teams) && payload.teams.length >= 2
        ? payload.teams.map((t, idx) => ({
            id: `${id}-t${idx + 1}`,
            name: String(t.name || `Team ${idx + 1}`)
              .trim()
              .slice(0, 50) || `Team ${idx + 1}`,
            captainId: null,
            playerIds: [],
            budgetUsed: 0,
          }))
        : ['Side A', 'Side B'].map((name, idx) => ({
            id: `${id}-t${idx + 1}`,
            name,
            captainId: null,
            playerIds: [],
            budgetUsed: 0,
          }))

    setSessionTeams((prev) => ({
      ...prev,
      [id]: teamsPayload,
    }))

    return { ok: true, id }
  }

  const updateSession = async (sessionId, payload, leagueIdOpt = null) => {
    const sidStr = String(sessionId ?? '').trim()
    const session = sessions.find((s) => String(s.id) === sidStr)
    const leagueId =
      leagueIdOpt != null && String(leagueIdOpt).trim() !== ''
        ? String(leagueIdOpt).trim()
        : session?.leagueId != null
          ? String(session.leagueId)
          : null

    const mayUpdate =
      (leagueId && canManageLeague(leagueId)) ||
      (session && canManageLeague(String(session.leagueId)))

    if (!mayUpdate) {
      return { ok: false, reason: 'Only league owners and managers can edit sessions.' }
    }

    const uid = parseDbUserId(currentUserId)
    const sid = Number.parseInt(sidStr, 10)
    const looksLikeDbSessionId = /^\d+$/.test(sidStr)
    if (uid != null && looksLikeDbSessionId && !Number.isNaN(sid)) {
      try {
        const body = {
          actingUserId: uid,
        }
        if (payload.title != null) body.title = String(payload.title).trim()
        if (payload.dateIso) body.sessionDate = payload.dateIso
        if (payload.time24) body.sessionTime = payload.time24
        if (payload.location !== undefined) body.location = payload.location
        if (payload.format != null) body.format = payload.format
        if (payload.budgetPerTeam != null) body.budgetPerTeam = Number(payload.budgetPerTeam)
        if (payload.status != null) body.status = payload.status
        if (Array.isArray(payload.teams) && payload.teams.length >= 2) {
          body.teams = payload.teams.map((t) => ({
            name: String(typeof t === 'string' ? t : t?.name || '')
              .trim()
              .slice(0, 50),
          }))
        }
        await apiFetch(`/api/sessions/${sid}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        await refreshSessionsFromApi()
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: err?.message || 'Could not update session.' }
      }
    }

    persistSessions((prev) =>
      prev.map((session) => {
        if (String(session.id) !== sidStr) {
          return session
        }
        const pool = getLeagueMemberPlayerIds(session.leagueId)
        const next = { ...session }
        if (payload.title != null) next.title = String(payload.title).trim()
        if (payload.dateIso) {
          next.dateIso = payload.dateIso
          next.date = formatDateFromIso(payload.dateIso)
        }
        if (payload.time24) {
          next.time24 = payload.time24
          next.time = formatTimeDisplay(payload.time24)
        }
        if (payload.location != null) next.location = payload.location
        if (payload.format != null) next.format = payload.format
        if (payload.budgetPerTeam != null) next.budgetPerTeam = Number(payload.budgetPerTeam)
        if (payload.status != null) next.status = payload.status
        if (payload.maxPlayers != null) {
          const maxPlayers = Math.min(Math.max(4, Number(payload.maxPlayers)), Math.max(4, pool.length))
          next.maxPlayers = maxPlayers
          next.players = pool.slice(0, maxPlayers)
        }
        return next
      }),
    )
    return { ok: true }
  }

  const deleteSession = async (sessionId, leagueIdOpt = null) => {
    const sidStr = String(sessionId ?? '').trim()
    const session = sessions.find((s) => String(s.id) === sidStr)
    const leagueId =
      leagueIdOpt != null && String(leagueIdOpt).trim() !== ''
        ? String(leagueIdOpt).trim()
        : session?.leagueId != null
          ? String(session.leagueId)
          : null

    const mayDelete =
      (leagueId && canManageLeague(leagueId)) ||
      (session && canManageLeague(String(session.leagueId)))

    if (!mayDelete) {
      return { ok: false, reason: 'Only league owners and managers can delete sessions.' }
    }

    const uid = parseDbUserId(currentUserId)
    const sid = Number.parseInt(sidStr, 10)
    const looksLikeDbSessionId = /^\d+$/.test(sidStr)
    if (uid != null && looksLikeDbSessionId && !Number.isNaN(sid)) {
      try {
        const q = new URLSearchParams({ actingUserId: String(uid) })
        await apiFetch(`/api/sessions/${sid}?${q.toString()}`, {
          method: 'DELETE',
          body: JSON.stringify({ actingUserId: uid }),
        })
        await refreshSessionsFromApi()
        return { ok: true }
      } catch (err) {
        return { ok: false, reason: err?.message || 'Could not delete session.' }
      }
    }

    persistSessions((prev) => prev.filter((s) => String(s.id) !== sidStr))
    setSessionTeams((prev) => {
      if (!prev[sidStr] && !prev[sessionId]) return prev
      const next = { ...prev }
      delete next[sidStr]
      delete next[sessionId]
      return next
    })
    return { ok: true }
  }

  const setTeamCaptain = (sessionId, teamId, captainPlayerId) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Session not found.' }
    }
    if (!isLeagueOwner(session.leagueId)) {
      return { ok: false, reason: 'Only the league owner can assign or remove team captains.' }
    }
    setSessionTeams((currentTeams) => {
      const teamsList = currentTeams[sessionId] ?? []
      return {
        ...currentTeams,
        [sessionId]: teamsList.map((team) =>
          team.id === teamId ? { ...team, captainId: captainPlayerId ?? null } : team,
        ),
      }
    })
    return { ok: true }
  }

  const createLeague = async ({ name, description, defaultFormat }) => {
    if (!currentUserId) {
      return { ok: false, reason: 'Log in to create a league.' }
    }
    const alreadyInLeague = leagueMembers.some((lm) => lm.userId === currentUserId)
    if (alreadyInLeague) {
      return { ok: false, reason: 'You can only be in one league right now. Leave your current league first.' }
    }
    const trimmed = name.trim()
    const uid = parseDbUserId(currentUserId)
    if (uid != null) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const inviteCode = `SIDE5-${randomInviteSuffix()}`
        try {
          const result = await apiFetch('/api/leagues', {
            method: 'POST',
            body: JSON.stringify({
              name: trimmed,
              description: description.trim() || null,
              inviteCode,
              ownerUserId: uid,
            }),
          })
          await refreshLeaguesFromApi()
          await refreshSessionsFromApi()
          const newId = result?.data?.id != null ? String(result.data.id) : null
          const code = result?.data?.invite_code ?? inviteCode
          if (newId) setActiveLeagueId(newId)
          return { ok: true, id: newId, inviteCode: code }
        } catch (err) {
          const msg = String(err?.message || '')
          if (msg.includes('invite') || msg.includes('409')) continue
          return { ok: false, reason: msg || 'Could not create league.' }
        }
      }
      return { ok: false, reason: 'Could not generate a unique invite code. Try again.' }
    }

    const id = `l${Date.now()}`
    const inviteCode = `SIDE5-${randomInviteSuffix()}`
    const row = {
      id,
      name: trimmed,
      description: description.trim() || 'No description yet.',
      inviteCode,
      memberCount: 1,
      sessionCount: 0,
      nextSessionId: null,
      defaultFormat: defaultFormat || '5v5',
    }
    persistLeagues((prev) => [...prev, row])
    persistLeagueMembers((prev) => [
      ...prev,
      {
        id: `lm-${Date.now()}`,
        leagueId: id,
        userId: currentUserId,
        role: 'owner',
        joinedAt: Date.now(),
      },
    ])
    setActiveLeagueId(id)
    return { ok: true, id, inviteCode }
  }

  const joinLeague = async (inviteCode) => {
    if (!currentUserId) {
      return { ok: false, reason: 'Log in to join a league.' }
    }
    const trimmed = String(inviteCode || '').trim()
    if (!trimmed) {
      return { ok: false, reason: 'Enter an invite code.' }
    }

    const uid = Number.parseInt(String(currentUserId), 10)
    const isApiUser = !Number.isNaN(uid) && String(uid) === String(currentUserId)

    if (isApiUser) {
      try {
        await apiFetch('/api/leagues/join', {
          method: 'POST',
          body: JSON.stringify({ inviteCode: trimmed, userId: uid }),
        })
        const leaguesMapped = (await refreshLeaguesFromApi()) ?? []
        await refreshSessionsFromApi()
        const norm = trimmed.toUpperCase()
        const joined = leaguesMapped.find((l) => String(l.inviteCode).trim().toUpperCase() === norm)
        if (joined) setActiveLeagueId(joined.id)
        return { ok: true, league: joined ?? leaguesMapped[0] ?? null }
      } catch (err) {
        return { ok: false, reason: err?.message || 'Could not join league.' }
      }
    }

    const alreadyInLeague = leagueMembers.some((lm) => lm.userId === currentUserId)
    if (alreadyInLeague) {
      return { ok: false, reason: 'You can only be in one league right now. Leave your current league first.' }
    }
    const code = trimmed.toUpperCase()
    const league = leagues.find((l) => String(l.inviteCode).trim().toUpperCase() === code)
    if (!league) {
      return { ok: false, reason: 'No league found for that invite code.' }
    }
    const exists = leagueMembers.some((lm) => lm.leagueId === league.id && lm.userId === currentUserId)
    if (!exists) {
      persistLeagueMembers((prev) => [
        ...prev,
        {
          id: `lm-${Date.now()}`,
          leagueId: league.id,
          userId: currentUserId,
          role: 'player',
          joinedAt: Date.now(),
        },
      ])
    }
    setActiveLeagueId(league.id)
    return { ok: true, league }
  }

  const leaveLeague = useCallback(
    async (leagueId) => {
      if (!currentUserId) {
        return { ok: false, reason: 'Log in to leave a league.' }
      }

      const uid = parseDbUserId(currentUserId)
      const leagueIdNum = Number.parseInt(String(leagueId), 10)
      if (uid != null && !Number.isNaN(leagueIdNum) && String(leagueIdNum) === String(leagueId)) {
        try {
          await apiFetch('/api/leagues/leave', {
            method: 'POST',
            body: JSON.stringify({ leagueId: leagueIdNum, userId: uid }),
          })
          await refreshLeaguesFromApi()
          await refreshSessionsFromApi()
          return { ok: true }
        } catch (err) {
          return { ok: false, reason: err?.message || 'Could not leave league.' }
        }
      }

      const memberRow = leagueMembers.find((lm) => lm.leagueId === leagueId && lm.userId === currentUserId)
      if (!memberRow) {
        return { ok: false, reason: 'You are not a member of this league.' }
      }

      const otherMembers = leagueMembers.filter((lm) => lm.leagueId === leagueId && lm.userId !== currentUserId)
      persistLeagueMembers((prev) => {
        const withoutMe = prev.filter((lm) => !(lm.leagueId === leagueId && lm.userId === currentUserId))
        if (memberRow.role !== 'owner' || otherMembers.length === 0) return withoutMe
        const nextOwnerUserId = otherMembers[0].userId
        return withoutMe.map((lm) =>
          lm.leagueId === leagueId && lm.userId === nextOwnerUserId ? { ...lm, role: 'owner' } : lm,
        )
      })
      const remainingMyLeagueIds = leagueMembers
        .filter((lm) => lm.userId === currentUserId && lm.leagueId !== leagueId)
        .map((lm) => lm.leagueId)

      if (memberRow.role === 'owner' && otherMembers.length === 0) {
        persistLeagues((prev) => prev.filter((league) => league.id !== leagueId))
        persistSessions((prev) => prev.filter((session) => session.leagueId !== leagueId))
        setSessionTeams((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((sessionId) => {
            const session = sessions.find((row) => row.id === sessionId)
            if (session?.leagueId === leagueId) delete next[sessionId]
          })
          return next
        })
        persistSubmissions(statSubmissions.filter((submission) => submission.leagueId !== leagueId))
      }

      if (activeLeagueId === leagueId) {
        const fallbackLeagueId = remainingMyLeagueIds[0] ?? null
        setActiveLeagueId(fallbackLeagueId)
      }

      return { ok: true }
    },
    [
      activeLeagueId,
      currentUserId,
      leagueMembers,
      persistLeagues,
      persistSessions,
      refreshLeaguesFromApi,
      refreshSessionsFromApi,
      sessions,
      setActiveLeagueId,
      statSubmissions,
    ],
  )

  const promoteToManager = useCallback(
    (leagueId, targetUserId) => {
      if (!currentUserId) {
        return { ok: false, reason: 'Log in.' }
      }
      const myRole = getLeagueMemberRole(leagueId, currentUserId)
      if (myRole !== 'owner') {
        return { ok: false, reason: 'Only the league owner can promote managers.' }
      }
      const target = leagueMembers.find((lm) => lm.leagueId === leagueId && lm.userId === targetUserId)
      if (!target || target.role !== 'player') {
        return { ok: false, reason: 'You can only promote players to manager.' }
      }
      persistLeagueMembers((prev) =>
        prev.map((lm) =>
          lm.leagueId === leagueId && lm.userId === targetUserId ? { ...lm, role: 'manager' } : lm,
        ),
      )
      return { ok: true }
    },
    [currentUserId, getLeagueMemberRole, leagueMembers],
  )

  const transferLeagueOwnership = useCallback(
    (leagueId, newOwnerUserId) => {
      if (!currentUserId) {
        return { ok: false, reason: 'Log in.' }
      }
      if (String(newOwnerUserId) === String(currentUserId)) {
        return { ok: false, reason: 'Pick a different member to receive ownership.' }
      }
      if (getLeagueMemberRole(leagueId, currentUserId) !== 'owner') {
        return { ok: false, reason: 'Only the league owner can transfer ownership.' }
      }
      const target = leagueMembers.find((lm) => String(lm.leagueId) === String(leagueId) && String(lm.userId) === String(newOwnerUserId))
      if (!target) {
        return { ok: false, reason: 'That user is not in this league.' }
      }
      persistLeagueMembers((prev) =>
        prev.map((lm) => {
          if (String(lm.leagueId) !== String(leagueId)) return lm
          if (String(lm.userId) === String(currentUserId)) return { ...lm, role: 'manager' }
          if (String(lm.userId) === String(newOwnerUserId)) return { ...lm, role: 'owner' }
          return lm
        }),
      )
      return { ok: true }
    },
    [currentUserId, getLeagueMemberRole, leagueMembers],
  )

  const demoteLeagueManagerToPlayer = useCallback(
    (leagueId, targetUserId) => {
      if (!currentUserId) {
        return { ok: false, reason: 'Log in.' }
      }
      if (getLeagueMemberRole(leagueId, currentUserId) !== 'owner') {
        return { ok: false, reason: 'Only the league owner can change roles.' }
      }
      const target = leagueMembers.find((lm) => String(lm.leagueId) === String(leagueId) && String(lm.userId) === String(targetUserId))
      if (!target || target.role !== 'manager') {
        return { ok: false, reason: 'That member is not a manager.' }
      }
      persistLeagueMembers((prev) =>
        prev.map((lm) =>
          String(lm.leagueId) === String(leagueId) && String(lm.userId) === String(targetUserId)
            ? { ...lm, role: 'player' }
            : lm,
        ),
      )
      return { ok: true }
    },
    [currentUserId, getLeagueMemberRole, leagueMembers],
  )

  const clearLeagueCaptainsForUser = useCallback(
    (leagueId, targetUserId) => {
      if (getLeagueMemberRole(leagueId, currentUserId) !== 'owner') {
        return { ok: false, reason: 'Only the league owner can remove captain assignments.' }
      }
      const user = users.find((u) => String(u.id) === String(targetUserId))
      const playerId = user?.playerId
      if (!playerId) {
        return { ok: false, reason: 'Could not resolve that member for captain removal.' }
      }
      const sessionIds = sessions.filter((s) => String(s.leagueId) === String(leagueId)).map((s) => s.id)
      setSessionTeams((prev) => {
        const next = { ...prev }
        sessionIds.forEach((sid) => {
          const list = next[sid] ?? []
          next[sid] = list.map((team) =>
            String(team.captainId) === String(playerId) ? { ...team, captainId: null } : team,
          )
        })
        return next
      })
      return { ok: true }
    },
    [currentUserId, getLeagueMemberRole, sessions, users],
  )

  const value = {
    users,
    players,
    leagues,
    leaguesDisplay,
    leagueMembers,
    currentUserId,
    currentUser,
    activeLeagueId,
    activeLeague,
    myLeagueIds,
    setActiveLeagueId,
    sessions,
    matches,
    sessionTeams,
    statSubmissions,
    reviewAssignments,
    playerReviews,
    mvpVotes,
    logout,
    setAuthenticatedUser,
    updateCurrentUserProfileImage,
    getLeagueMemberPlayerIds,
    getLeaguePlayers,
    getLeagueMemberRole,
    canManageLeague,
    isLeagueOwner,
    canManageSession,
    isCurrentUserSessionCaptain,
    canApproveStatsForMatch,
    confirmAttendance,
    addPlayerToTeam,
    balanceTeams,
    lockTeams,
    createSession,
    updateSession,
    deleteSession,
    setTeamCaptain,
    submitStats,
    reviewSubmission,
    getMyStatSubmissionForMatch,
    getAssignedReviewPlayerIds,
    submitPlayerReviews,
    submitMvpVote,
    getMvpWinnerByMatch,
    getPlayerIdentity,
    getPlayerAttributeProfile,
    getMatchContext,
    createLeague,
    joinLeague,
    leaveLeague,
    promoteToManager,
    transferLeagueOwnership,
    demoteLeagueManagerToPlayer,
    clearLeagueCaptainsForUser,
    refreshLeaguesFromApi,
    refreshSessionsFromApi,
  }

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>
}

export function useMockApp() {
  const context = useContext(MockAppContext)
  if (!context) {
    throw new Error('useMockApp must be used within MockAppProvider')
  }
  return context
}
