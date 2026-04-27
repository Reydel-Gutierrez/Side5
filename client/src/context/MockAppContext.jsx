import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  findUserByUsername,
  initialLeagueMembers,
  leagues as initialLeagues,
  matches as initialMatches,
  players as initialPlayers,
  sessions as initialSessions,
  submittedStats as initialSubmittedStats,
  teams as initialTeams,
  users,
} from '../data/mockData'
import { autoBalanceTeams } from '../utils/draftUtils'
import { formatDateFromIso, formatTimeDisplay } from '../utils/sessionDisplay'
import { sessionRosterIds } from '../utils/sessionRoster'

const MockAppContext = createContext(null)

const SESSIONS_STORAGE_KEY = 'side5-sessions'
const LEAGUES_STORAGE_KEY = 'side5-leagues'
const ACTIVE_LEAGUE_STORAGE_KEY = 'side5-active-league-id'
const LEAGUE_MEMBERS_STORAGE_KEY = 'side5-league-members'
const CURRENT_USER_STORAGE_KEY = 'side5-current-user-id'
const AUTH_USERS_STORAGE_KEY = 'side5-auth-users'
const DATA_VERSION_STORAGE_KEY = 'side5-data-version'
const DATA_VERSION = '2026-04-mock-reset'
const DEFAULT_LEAGUE_RATING = 7
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
    window.localStorage.removeItem('side5-stat-submissions')
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
    return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
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
    try {
      const stored = window.localStorage.getItem('side5-stat-submissions')
      if (!stored) return initialSubmittedStats
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return initialSubmittedStats
      return parsed.map((row) => ({
        ...row,
        leagueId: row.leagueId ?? initialMatches.find((m) => m.id === row.matchId)?.leagueId ?? null,
        sessionId: row.sessionId ?? initialMatches.find((m) => m.id === row.matchId)?.sessionId ?? null,
      }))
    } catch {
      return initialSubmittedStats
    }
  })
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
      return authUsers.find((u) => u.id === currentUserId) ?? users.find((u) => u.id === currentUserId) ?? null
    },
    [currentUserId, authUsers],
  )

  const allAuthUsers = useMemo(() => {
    const merged = [...users]
    authUsers.forEach((storedUser) => {
      if (!merged.some((seedUser) => seedUser.id === storedUser.id)) merged.push(storedUser)
    })
    return merged
  }, [authUsers])

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
    (leagueId, userId) => leagueMembers.find((lm) => lm.leagueId === leagueId && lm.userId === userId)?.role ?? null,
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

  const canManageSession = useCallback(
    (sessionId) => {
      const session = sessions.find((s) => s.id === sessionId)
      if (!session) return false
      return canManageLeague(session.leagueId)
    },
    [sessions, canManageLeague],
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

      const aggregate = new Map()
      approved.forEach((row) => {
        const curr = aggregate.get(row.playerId) ?? { games: 0, goals: 0, assists: 0, saves: 0, mvps: 0 }
        curr.games += 1
        curr.goals += Number(row.goals) || 0
        curr.assists += Number(row.assists) || 0
        curr.saves += Number(row.saves) || 0
        curr.mvps += row.mvp ? 1 : 0
        aggregate.set(row.playerId, curr)
      })

      const rawByPlayerId = new Map()
      memberPlayerIds.forEach((playerId) => {
        const base = players.find((p) => p.id === playerId)
        if (!base) return
        const agg = aggregate.get(playerId) ?? { games: 0, goals: 0, assists: 0, saves: 0, mvps: 0 }
        const hasStats = agg.games > 0
        const winRate = hasStats ? 50 : 0
        const scorePerGame = hasStats
          ? (agg.goals * 4 + agg.assists * 3 + agg.saves + agg.mvps * 2) / Math.max(1, agg.games)
          : 0
        const rating = hasStats ? clamp(6 + scorePerGame * 0.35, 5.5, 9.8) : null
        const value = hasStats ? clamp(rating * 1.35, 6, 25) : null
        rawByPlayerId.set(playerId, {
          ...base,
          ...agg,
          winRate,
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
    [getLeagueMemberPlayerIds, players, statSubmissions],
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
      const leagueSessions = sessions.filter((s) => s.leagueId === league.id)
      const memberPlayerCount = getLeagueMemberPlayerIds(league.id).length
      const upcoming = [...leagueSessions]
        .filter((s) => s.status !== 'completed')
        .sort((a, b) => `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`))
      map[league.id] = {
        sessionCount: leagueSessions.length,
        memberCount: memberPlayerCount,
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
    return leaguesDisplay.find((l) => l.id === activeLeagueId) ?? null
  }, [leaguesDisplay, activeLeagueId])

  const myLeagueIds = useMemo(() => {
    if (!currentUserId) return []
    return leagueMembers.filter((lm) => lm.userId === currentUserId).map((lm) => lm.leagueId)
  }, [currentUserId, leagueMembers])

  const login = useCallback(
    (username, password) => {
      const normalizedUsername = String(username || '').trim().toLowerCase()
      const user =
        allAuthUsers.find((u) => String(u.username || '').toLowerCase() === normalizedUsername) ??
        findUserByUsername(username)
      if (!user || user.password !== password) {
        return { ok: false, reason: 'Invalid username or password.' }
      }
      setCurrentUserIdState(user.id)
      try {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, user.id)
      } catch {
        /* ignore */
      }
      const rawMembers = readStoredLeagueMembers()
      const memberList = rawMembers === null ? [...initialLeagueMembers] : rawMembers
      const mine = memberList.filter((lm) => lm.userId === user.id)
      const storedLeague = readActiveLeagueId()
      const nextActive =
        storedLeague && mine.some((m) => m.leagueId === storedLeague) ? storedLeague : (mine[0]?.leagueId ?? null)
      setActiveLeagueId(nextActive)
      return { ok: true, user }
    },
    [allAuthUsers, setActiveLeagueId],
  )

  const signup = useCallback(
    ({ fullName, username, password, position }) => {
      const normalizedUsername = String(username || '')
        .trim()
        .toLowerCase()
      const displayName = String(fullName || '').trim()
      const rawPassword = String(password || '').trim()
      if (!normalizedUsername || !displayName || !rawPassword) {
        return { ok: false, reason: 'Please fill in all required fields.' }
      }
      const exists = allAuthUsers.some((u) => String(u.username || '').toLowerCase() === normalizedUsername)
      if (exists) {
        return { ok: false, reason: 'Username already exists.' }
      }

      const newUser = {
        id: `u-local-${Date.now()}`,
        username: normalizedUsername,
        password: rawPassword,
        displayName,
        initials: displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('') || normalizedUsername.slice(0, 2).toUpperCase(),
        position: position || 'Midfielder',
        baseValue: 7,
        rating: 7,
        playerId: null,
        email: '',
        phone: '',
        memberSince: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }

      setAuthUsers((current) => {
        const next = [...current, newUser]
        try {
          window.localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })

      setCurrentUserIdState(newUser.id)
      try {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, newUser.id)
      } catch {
        /* ignore */
      }
      setActiveLeagueId(null)
      return { ok: true, user: newUser }
    },
    [allAuthUsers, setActiveLeagueId],
  )

  const logout = useCallback(() => {
    setCurrentUserIdState(null)
    setActiveLeagueId(null)
    try {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [setActiveLeagueId])

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
      window.localStorage.setItem('side5-stat-submissions', JSON.stringify(nextSubmissions))
    } catch {
      /* ignore */
    }
  }

  const addPlayerToTeam = (sessionId, teamId, playerId) => {
    if (!canManageSession(sessionId)) {
      return { ok: false, reason: 'Only league owners and managers can draft players.' }
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
    if (!canManageSession(sessionId)) {
      return { ok: false, reason: 'Only league owners and managers can balance teams.' }
    }
    const session = sessions.find((item) => item.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Session not found' }
    }

    const roster = new Set(sessionRosterIds(session))
    const leaguePlayers = getLeaguePlayers(session.leagueId)
    const draftPool = leaguePlayers.filter((player) => roster.has(player.id))
    const balancedTeams = autoBalanceTeams(draftPool, 3, session.budgetPerTeam)

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
    if (!canManageSession(sessionId)) {
      return { ok: false, reason: 'Only league owners and managers can lock teams.' }
    }
    persistSessions((currentSessions) =>
      currentSessions.map((session) => (session.id === sessionId ? { ...session, status: 'locked' } : session)),
    )
    return { ok: true }
  }

  const submitStats = ({ matchId, playerId, teamId, goals, assists, saves, mvp, notes }) => {
    const me = currentUser?.playerId
    if (!me) {
      return { ok: false, reason: 'Log in to submit stats.' }
    }
    if (playerId !== me) {
      return { ok: false, reason: 'You can only submit stats for yourself.' }
    }
    const match = matches.find((m) => m.id === matchId)
    const session = sessions.find((s) => s.id === match?.sessionId)
    const newSubmission = {
      id: `sub-${Date.now()}`,
      matchId,
      sessionId: session?.id ?? match?.sessionId ?? null,
      leagueId: match?.leagueId ?? session?.leagueId ?? null,
      playerId,
      submittedBy: me,
      teamId,
      goals,
      assists,
      saves,
      mvp,
      notes,
      status: 'pending',
      createdAt: Date.now(),
    }
    const nextSubmissions = [newSubmission, ...statSubmissions]
    persistSubmissions(nextSubmissions)
    return { ok: true, submission: newSubmission }
  }

  const reviewSubmission = (submissionId, status) => {
    const submission = statSubmissions.find((s) => s.id === submissionId)
    if (!submission || !canApproveStatsForMatch(submission.matchId)) {
      return { ok: false, reason: 'Only team captains or league managers can approve stats.' }
    }
    const nextSubmissions = statSubmissions.map((s) => (s.id === submissionId ? { ...s, status } : s))
    persistSubmissions(nextSubmissions)
    return { ok: true }
  }

  const createSession = (payload) => {
    const leagueId = payload.leagueId ?? activeLeagueId
    if (!leagueId || !canManageLeague(leagueId)) {
      return { ok: false, reason: 'Only league owners and managers can create sessions.', id: null }
    }
    const pool = getLeagueMemberPlayerIds(leagueId)
    const id = `s${Date.now()}`
    const maxPlayers = Math.min(Math.max(4, Number(payload.maxPlayers) || 8), Math.max(4, pool.length))
    const league = leagues.find((l) => l.id === leagueId)
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
    return { ok: true, id }
  }

  const updateSession = (sessionId, payload) => {
    if (!canManageSession(sessionId)) {
      return { ok: false, reason: 'Only league owners and managers can edit sessions.' }
    }
    persistSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) {
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

  const setTeamCaptain = (sessionId, teamId, captainId) => {
    if (!canManageSession(sessionId)) {
      return { ok: false, reason: 'Only league owners and managers can assign captains.' }
    }
    setSessionTeams((currentTeams) => {
      const teamsList = currentTeams[sessionId] ?? []
      return {
        ...currentTeams,
        [sessionId]: teamsList.map((team) => (team.id === teamId ? { ...team, captainId } : team)),
      }
    })
    return { ok: true }
  }

  const createLeague = ({ name, description, defaultFormat }) => {
    if (!currentUserId) {
      return { ok: false, reason: 'Log in to create a league.' }
    }
    const alreadyInLeague = leagueMembers.some((lm) => lm.userId === currentUserId)
    if (alreadyInLeague) {
      return { ok: false, reason: 'You can only be in one league right now. Leave your current league first.' }
    }
    const trimmed = name.trim()
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

  const joinLeague = (inviteCode) => {
    if (!currentUserId) {
      return { ok: false, reason: 'Log in to join a league.' }
    }
    const alreadyInLeague = leagueMembers.some((lm) => lm.userId === currentUserId)
    if (alreadyInLeague) {
      return { ok: false, reason: 'You can only be in one league right now. Leave your current league first.' }
    }
    const code = inviteCode.trim().toUpperCase()
    const league = leagues.find((l) => l.inviteCode.toUpperCase() === code)
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
    (leagueId) => {
      if (!currentUserId) {
        return { ok: false, reason: 'Log in to leave a league.' }
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
    login,
    signup,
    logout,
    getLeagueMemberPlayerIds,
    getLeaguePlayers,
    getLeagueMemberRole,
    canManageLeague,
    canManageSession,
    canApproveStatsForMatch,
    confirmAttendance,
    addPlayerToTeam,
    balanceTeams,
    lockTeams,
    createSession,
    updateSession,
    setTeamCaptain,
    submitStats,
    reviewSubmission,
    createLeague,
    joinLeague,
    leaveLeague,
    promoteToManager,
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
