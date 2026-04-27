/** All mock passwords are `1234` (see Login / README). */

export const users = [
  {
    id: 'u1',
    username: 'reydel',
    password: '1234',
    displayName: 'Reydel',
    initials: 'RY',
    position: 'Forward',
    baseValue: 10,
    rating: 7,
    playerId: 'p1',
    email: 'reydel@side5.app',
    phone: '+1 (555) 014-2203',
    memberSince: 'March 2025',
  },
]

function playerFromUser(user, extra) {
  return {
    id: user.playerId,
    userId: user.id,
    name: user.displayName,
    initials: user.initials,
    position: user.position,
    value: user.baseValue,
    rating: user.rating,
    goals: extra.goals,
    assists: extra.assists,
    saves: extra.saves,
    mvps: extra.mvps,
    games: extra.games,
    winRate: extra.winRate,
    status: extra.status,
  }
}

export const players = users.map((user, index) =>
  playerFromUser(user, {
    goals: 0,
    assists: 0,
    saves: 0,
    mvps: 0,
    games: 0,
    winRate: 0,
    status: index === 0 ? 'confirmed' : 'invited',
  }),
)

export const leagues = []

export const initialLeagueMembers = []

export const sessions = []

export const teams = [
  { id: 'ta', name: 'Team A', captainId: null, playerIds: [], budgetUsed: 0 },
  { id: 'tb', name: 'Team B', captainId: null, playerIds: [], budgetUsed: 0 },
  { id: 'tc', name: 'Team C', captainId: null, playerIds: [], budgetUsed: 0 },
]

export const matches = []

export const submittedStats = []

export const teamTabs = [
  { id: 'ta', label: 'Team A' },
  { id: 'tb', label: 'Team B' },
  { id: 'tc', label: 'Team C' },
]

export function findUserByUsername(username) {
  const u = String(username || '').trim().toLowerCase()
  return users.find((x) => x.username.toLowerCase() === u) ?? null
}
