/** SQL fragments: league_members is source of truth when joined for a league context. */

const LM_RATING_SQL = 'COALESCE(lm.rating, u.rating, 6.0)'
const LM_WORTH_SQL = 'COALESCE(lm.player_worth, u.base_value, 10.00)'
const LM_OVR_SQL = `COALESCE(lm.ovr, ROUND(${LM_RATING_SQL} * 10), 60)`

function leagueMemberJoinForSession() {
  return `LEFT JOIN sessions s_lm ON s_lm.id = sp.session_id
          LEFT JOIN league_members lm ON lm.league_id = s_lm.league_id AND lm.user_id = u.id AND lm.is_active = TRUE`
}

function leagueMemberJoinForTeamSession() {
  return `INNER JOIN teams t_lm ON t_lm.id = tp.team_id
          INNER JOIN sessions s_lm ON s_lm.id = t_lm.session_id
          LEFT JOIN league_members lm ON lm.league_id = s_lm.league_id AND lm.user_id = u.id AND lm.is_active = TRUE`
}

module.exports = {
  LM_RATING_SQL,
  LM_WORTH_SQL,
  LM_OVR_SQL,
  leagueMemberJoinForSession,
  leagueMemberJoinForTeamSession,
}
