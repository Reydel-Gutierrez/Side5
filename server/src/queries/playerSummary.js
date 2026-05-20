const { query } = require('../db/pool')

async function fetchLeagueMemberSummary(playerId, leagueId) {
  const rows = await query(
    `SELECT u.id,
            u.username,
            u.display_name,
            u.avatar_image,
            lm.league_id,
            lm.rating,
            lm.player_worth,
            lm.ovr,
            lm.matches_played,
            lm.goals,
            lm.wins,
            lm.losses,
            lm.mvp_count,
            COALESCE(pp.main_archetype, 'None') AS main_archetype
     FROM league_members lm
     INNER JOIN users u ON u.id = lm.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE lm.user_id = ? AND lm.league_id = ? AND lm.is_active = TRUE
     LIMIT 1`,
    [playerId, leagueId],
  )
  return rows[0] ?? null
}

async function fetchPrimaryLeagueMemberSummary(playerId) {
  const rows = await query(
    `SELECT u.id,
            u.username,
            u.display_name,
            u.avatar_image,
            lm.league_id,
            lm.rating,
            lm.player_worth,
            lm.ovr,
            lm.matches_played,
            lm.goals,
            lm.wins,
            lm.losses,
            lm.mvp_count,
            COALESCE(pp.main_archetype, 'None') AS main_archetype
     FROM league_members lm
     INNER JOIN users u ON u.id = lm.user_id
     LEFT JOIN player_profiles pp ON pp.user_id = u.id
     WHERE lm.user_id = ? AND lm.is_active = TRUE
     ORDER BY lm.joined_at ASC
     LIMIT 1`,
    [playerId],
  )
  return rows[0] ?? null
}

async function fetchApprovedStatExtras(playerId, leagueId) {
  const rows = await query(
    `SELECT COALESCE(SUM(ss.assists), 0) AS assists,
            COALESCE(SUM(ss.saves), 0) AS saves
     FROM stat_submissions ss
     WHERE ss.user_id = ?
       AND ss.status = 'approved'
       AND (? IS NULL OR ss.league_id = ?)`,
    [playerId, leagueId, leagueId],
  )
  return rows[0] ?? { assists: 0, saves: 0 }
}

function mapSummaryResponse(memberRow, extras = {}) {
  const rating = Number(Number(memberRow.rating).toFixed(1)) || 6.0
  const playerWorth = Number(memberRow.player_worth) || 10
  const ovr = Number(memberRow.ovr) || Math.round(rating * 10)

  return {
    id: memberRow.id,
    username: memberRow.username,
    display_name: memberRow.display_name,
    avatar_image: memberRow.avatar_image || '',
    league_id: memberRow.league_id,
    rating,
    player_worth: playerWorth,
    base_value: playerWorth,
    total_worth: playerWorth,
    ovr,
    main_archetype: memberRow.main_archetype || 'None',
    matches_played: Number(memberRow.matches_played) || 0,
    goals: Number(memberRow.goals) || 0,
    wins: Number(memberRow.wins) || 0,
    losses: Number(memberRow.losses) || 0,
    mvp_trophies: Number(memberRow.mvp_count) || 0,
    assists: Number(extras.assists) || 0,
    saves: Number(extras.saves) || 0,
  }
}

async function buildPlayerSummary(playerId, leagueId) {
  const member =
    leagueId != null
      ? await fetchLeagueMemberSummary(playerId, leagueId)
      : await fetchPrimaryLeagueMemberSummary(playerId)

  if (!member) {
    return null
  }

  const extras = await fetchApprovedStatExtras(playerId, member.league_id)
  return mapSummaryResponse(member, extras)
}

module.exports = {
  buildPlayerSummary,
  fetchLeagueMemberSummary,
}
