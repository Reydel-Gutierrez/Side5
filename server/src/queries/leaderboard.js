const { query } = require('../db/pool')

const LEAGUE_LEADERBOARD_SQL = `
  SELECT lm.user_id,
         u.username,
         u.display_name,
         lm.matches_played,
         lm.rating,
         lm.ovr,
         lm.player_worth,
         lm.goals,
         lm.wins,
         lm.losses,
         lm.mvp_count,
         lm.is_active
  FROM league_members lm
  INNER JOIN users u ON lm.user_id = u.id
  WHERE lm.league_id = ?
    AND (? = 1 OR lm.is_active = TRUE)
  ORDER BY lm.rating DESC, lm.matches_played DESC, lm.goals DESC, u.display_name ASC
`

function mapLeaderboardRow(row) {
  const matchesPlayed = Number(row.matches_played) || 0
  const rating = Number(Number(row.rating).toFixed(1))
  const safeRating = Number.isFinite(rating) ? rating : 6.0
  const playerWorth = Number(row.player_worth) || 10
  const ovr = Number(row.ovr) || Math.round(safeRating * 10)

  return {
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    matches_played: matchesPlayed,
    rating: safeRating,
    ovr,
    player_worth: playerWorth,
    goals: Number(row.goals) || 0,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    mvp_count: Number(row.mvp_count) || 0,
    is_active: Boolean(row.is_active),
  }
}

async function fetchLeagueLeaderboard(leagueId, { includeInactive = false } = {}) {
  const rows = await query(LEAGUE_LEADERBOARD_SQL, [leagueId, includeInactive ? 1 : 0])
  return rows.map(mapLeaderboardRow)
}

async function fetchGlobalLeaderboard() {
  const rows = await query(
    `SELECT u.id AS user_id,
            u.username,
            u.display_name,
            COALESCE(SUM(lm.matches_played), 0) AS matches_played,
            COALESCE(ROUND(AVG(lm.rating), 1), 6.0) AS rating,
            COALESCE(ROUND(AVG(lm.ovr)), 60) AS ovr,
            COALESCE(ROUND(AVG(lm.player_worth), 2), 10.00) AS player_worth,
            COALESCE(SUM(lm.goals), 0) AS goals,
            COALESCE(SUM(lm.wins), 0) AS wins,
            COALESCE(SUM(lm.losses), 0) AS losses,
            COALESCE(SUM(lm.mvp_count), 0) AS mvp_count,
            TRUE AS is_active
     FROM users u
     INNER JOIN league_members lm ON lm.user_id = u.id AND lm.is_active = TRUE
     GROUP BY u.id, u.username, u.display_name
     ORDER BY rating DESC, matches_played DESC, goals DESC, u.display_name ASC`,
  )
  return rows.map(mapLeaderboardRow)
}

module.exports = {
  fetchLeagueLeaderboard,
  fetchGlobalLeaderboard,
  mapLeaderboardRow,
}
