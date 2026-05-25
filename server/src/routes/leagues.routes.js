const express = require('express')
const { query, pool } = require('../db/pool')
const { fetchLeagueLeaderboard } = require('../queries/leaderboard')
const {
  LM_STYLE_COLUMNS_SQL,
  buildStyleResponseFromMemberRow,
} = require('../constants/playStyles')

const router = express.Router()

const INSERT_LEAGUE_MEMBER_SQL = `
  INSERT INTO league_members (league_id, user_id, role)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE is_active = TRUE
`

async function deactivateLeagueMember(conn, leagueId, userId) {
  await conn.execute(
    `UPDATE league_members SET is_active = FALSE WHERE league_id = ? AND user_id = ?`,
    [leagueId, userId],
  )
}

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

async function deleteLeagueCascade(conn, leagueId) {
  const [sessionRows] = await conn.execute('SELECT id FROM sessions WHERE league_id = ?', [leagueId])
  const sessionIds = (Array.isArray(sessionRows) ? sessionRows : []).map((r) => r.id)
  if (sessionIds.length) {
    const ph = sessionIds.map(() => '?').join(', ')
    const [matchRows] = await conn.execute(`SELECT id FROM matches WHERE session_id IN (${ph})`, sessionIds)
    const matchIds = (Array.isArray(matchRows) ? matchRows : []).map((r) => r.id)
    if (matchIds.length) {
      const mph = matchIds.map(() => '?').join(', ')
      await conn.execute(`DELETE FROM stat_submissions WHERE match_id IN (${mph})`, matchIds)
      await conn.execute(`DELETE FROM matches WHERE id IN (${mph})`, matchIds)
    }
    const [teamRows] = await conn.execute(`SELECT id FROM teams WHERE session_id IN (${ph})`, sessionIds)
    const teamIds = (Array.isArray(teamRows) ? teamRows : []).map((r) => r.id)
    if (teamIds.length) {
      const tph = teamIds.map(() => '?').join(', ')
      await conn.execute(`DELETE FROM team_players WHERE team_id IN (${tph})`, teamIds)
      await conn.execute(`DELETE FROM teams WHERE id IN (${tph})`, teamIds)
    }
    await conn.execute(`DELETE FROM session_players WHERE session_id IN (${ph})`, sessionIds)
    await conn.execute(`DELETE FROM sessions WHERE id IN (${ph})`, sessionIds)
  }
  await conn.execute('DELETE FROM stat_submissions WHERE league_id = ?', [leagueId])
  await conn.execute('DELETE FROM league_members WHERE league_id = ?', [leagueId])
  await conn.execute('DELETE FROM leagues WHERE id = ?', [leagueId])
}

router.get('/', async (_req, res) => {
  try {
    const leagues = await query(
      `SELECT l.id, l.name, l.description, l.invite_code, l.owner_user_id, l.created_at,
              u.display_name AS owner_name
       FROM leagues l
       INNER JOIN users u ON l.owner_user_id = u.id
       ORDER BY l.created_at DESC`
    )
    return res.json({ data: leagues, count: leagues.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

/** Leagues the user belongs to (for client sync; must be registered before /:id). */
router.get('/mine', async (req, res) => {
  const userId = Number.parseInt(String(req.query.userId ?? ''), 10)
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'userId query parameter is required and must be a number' })
  }

  try {
    const users = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }

    const rows = await query(
      `SELECT l.id, l.name, l.description, l.invite_code, l.owner_user_id, l.created_at,
              lm.role AS my_role,
              lm.joined_at,
              u.display_name AS owner_name,
              (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id AND lm2.is_active = TRUE) AS member_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.league_id = l.id) AS session_count
       FROM league_members lm
       INNER JOIN leagues l ON l.id = lm.league_id
       INNER JOIN users u ON l.owner_user_id = u.id
       WHERE lm.user_id = ? AND lm.is_active = TRUE
       ORDER BY lm.joined_at ASC`,
      [userId]
    )

    return res.json({ data: rows, count: rows.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

/** Past sessions for a league (stats finalized or status past/completed). */
router.get('/:id/sessions/past', async (req, res) => {
  const leagueId = Number.parseInt(req.params.id, 10)
  const userId = Number.parseInt(String(req.query.userId ?? ''), 10)

  if (Number.isNaN(leagueId)) {
    return res.status(400).json({ error: 'Invalid league id' })
  }
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'userId query parameter is required and must be a number' })
  }

  try {
    const leagues = await query('SELECT id, name FROM leagues WHERE id = ? LIMIT 1', [leagueId])
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }

    const membership = await query(
      'SELECT user_id FROM league_members WHERE league_id = ? AND user_id = ? LIMIT 1',
      [leagueId, userId],
    )
    if (!membership.length) {
      return res.status(403).json({ error: 'You are not a member of this league' })
    }

    const sessions = await query(
      `SELECT s.id, s.league_id, s.title, s.session_date, s.session_time, s.location,
              s.format, s.status,
              COALESCE(s.stats_finalized, 0) AS stats_finalized,
              s.stats_finalized_at,
              l.name AS league_name,
              (SELECT COUNT(*) FROM teams t WHERE t.session_id = s.id) AS team_count,
              (SELECT COUNT(DISTINCT tp.user_id)
               FROM team_players tp
               INNER JOIN teams t ON t.id = tp.team_id
               WHERE t.session_id = s.id) AS player_count
       FROM sessions s
       INNER JOIN leagues l ON l.id = s.league_id
       WHERE s.league_id = ?
         AND (COALESCE(s.stats_finalized, 0) = 1 OR s.status IN ('past', 'completed'))
       ORDER BY COALESCE(s.stats_finalized_at, s.session_date) DESC, s.session_time DESC`,
      [leagueId],
    )

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.json({ data: sessions, count: sessions.length, league_name: leagues[0].name })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/leaderboard', async (req, res) => {
  const leagueId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(leagueId)) {
    return res.status(400).json({ error: 'Invalid league id' })
  }

  try {
    const leagues = await query('SELECT id, name FROM leagues WHERE id = ? LIMIT 1', [leagueId])
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }

    const includeInactive =
      String(req.query.includeInactive ?? '').toLowerCase() === 'true' ||
      String(req.query.includeInactive ?? '') === '1'
    const players = await fetchLeagueLeaderboard(leagueId, { includeInactive })
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.json({
      data: {
        league_id: leagueId,
        league_name: leagues[0].name,
        players,
        count: players.length,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/members', async (req, res) => {
  const leagueId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(leagueId)) {
    return res.status(400).json({ error: 'Invalid league id' })
  }

  try {
    const leagues = await query('SELECT id, name FROM leagues WHERE id = ? LIMIT 1', [leagueId])
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }

    const members = await query(
      `SELECT lm.league_id, lm.user_id, lm.role, lm.joined_at, lm.is_active,
              u.username, u.display_name, '' AS avatar_image,
              lm.rating,
              lm.player_worth,
              lm.player_worth AS base_value,
              lm.ovr,
              COALESCE(pp.main_archetype, 'None') AS main_archetype,
              lm.mvp_count AS mvp_trophies,
              lm.goals,
              lm.matches_played,
              lm.wins,
              lm.losses,
              ${LM_STYLE_COLUMNS_SQL},
              EXISTS (
                SELECT 1
                FROM teams t
                INNER JOIN sessions s ON s.id = t.session_id
                WHERE s.league_id = lm.league_id
                  AND t.captain_user_id = lm.user_id
              ) AS is_team_captain
       FROM league_members lm
       INNER JOIN users u ON lm.user_id = u.id
       LEFT JOIN player_profiles pp ON pp.user_id = lm.user_id
       WHERE lm.league_id = ? AND lm.is_active = TRUE
       ORDER BY lm.joined_at ASC`,
      [leagueId]
    )

    const data = members.map((row) => {
      const style = buildStyleResponseFromMemberRow(row)
      return {
        ...row,
        main_archetype: style.main_archetype,
        archetype_description: style.archetype_description,
        style_counters: style.style_counters,
        style_radar: style.style_radar,
        has_style_data: style.has_style_data,
      }
    })
    return res.json({ data, count: data.length, league_name: leagues[0].name })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id', async (req, res) => {
  const leagueId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(leagueId)) {
    return res.status(400).json({ error: 'Invalid league id' })
  }

  try {
    const leagues = await query(
      `SELECT l.id, l.name, l.description, l.invite_code, l.owner_user_id, l.created_at,
              u.display_name AS owner_name
       FROM leagues l
       INNER JOIN users u ON l.owner_user_id = u.id
       WHERE l.id = ?
       LIMIT 1`,
      [leagueId]
    )

    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }

    return res.json({ data: leagues[0] })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/', async (req, res) => {
  const { name, description, inviteCode, ownerUserId } = req.body

  if (!name || !inviteCode || !ownerUserId) {
    return res.status(400).json({ error: 'name, inviteCode and ownerUserId are required' })
  }

  const normalizedInvite = String(inviteCode).trim().toUpperCase()

  try {
    const owners = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [ownerUserId])
    if (!owners.length) {
      return res.status(404).json({ error: 'Owner user not found' })
    }

    const result = await query(
      `INSERT INTO leagues (name, description, invite_code, owner_user_id)
       VALUES (?, ?, ?, ?)`,
      [name, description || null, normalizedInvite, ownerUserId]
    )

    await query(INSERT_LEAGUE_MEMBER_SQL, [result.insertId, ownerUserId, 'owner'])

    return res.status(201).json({
      message: 'League created',
      data: {
        id: result.insertId,
        name,
        description: description || null,
        invite_code: normalizedInvite,
        owner_user_id: ownerUserId,
      },
    })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'inviteCode already exists' })
    }
    return handleSqlError(res, error)
  }
})

router.post('/join', async (req, res) => {
  const { inviteCode, userId } = req.body

  if (!inviteCode || !userId) {
    return res.status(400).json({ error: 'inviteCode and userId are required' })
  }

  const normalizedCode = String(inviteCode).trim().toUpperCase()

  try {
    const users = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }

    const leagues = await query(
      'SELECT id FROM leagues WHERE UPPER(TRIM(invite_code)) = ? LIMIT 1',
      [normalizedCode]
    )
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found for invite code' })
    }

    const leagueId = leagues[0].id
    await query(INSERT_LEAGUE_MEMBER_SQL, [leagueId, userId, 'player'])

    return res.status(201).json({ message: 'Joined league', data: { leagueId, userId } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/leave', async (req, res) => {
  const leagueId = Number.parseInt(String(req.body?.leagueId ?? ''), 10)
  const userId = Number.parseInt(String(req.body?.userId ?? ''), 10)

  if (Number.isNaN(leagueId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'leagueId and userId are required numbers' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [memberRows] = await conn.execute(
      `SELECT lm.user_id, lm.role, l.owner_user_id
       FROM league_members lm
       INNER JOIN leagues l ON l.id = lm.league_id
       WHERE lm.league_id = ? AND lm.user_id = ? AND lm.is_active = TRUE
       LIMIT 1`,
      [leagueId, userId],
    )
    const member = Array.isArray(memberRows) ? memberRows[0] : null
    if (!member) {
      await conn.rollback()
      return res.status(404).json({ error: 'You are not an active member of this league.' })
    }

    const primaryOwnerId = Number(member.owner_user_id)
    const isPrimaryOwner = Number(userId) === primaryOwnerId

    const [countRows] = await conn.execute(
      `SELECT COUNT(*) AS c FROM league_members WHERE league_id = ? AND user_id <> ? AND is_active = TRUE`,
      [leagueId, userId],
    )
    const otherCount = Number((Array.isArray(countRows) ? countRows[0] : countRows)?.c) || 0

    if (!isPrimaryOwner) {
      await deactivateLeagueMember(conn, leagueId, userId)
      await conn.commit()
      return res.json({ message: 'Left league', data: { leagueId, userId } })
    }

    if (otherCount === 0) {
      await deleteLeagueCascade(conn, leagueId)
      await conn.commit()
      return res.json({ message: 'Left league; league removed (you were the only member).', data: { leagueId, userId } })
    }

    const [nextRows] = await conn.execute(
      `SELECT user_id FROM league_members
       WHERE league_id = ? AND user_id <> ? AND is_active = TRUE
       ORDER BY joined_at ASC, user_id ASC
       LIMIT 1`,
      [leagueId, userId],
    )
    const nextOwnerId = Array.isArray(nextRows) && nextRows[0] ? Number(nextRows[0].user_id) : NaN
    if (Number.isNaN(nextOwnerId)) {
      await conn.rollback()
      return res.status(500).json({ error: 'Could not assign a new league owner.' })
    }

    await conn.execute(`UPDATE league_members SET role = 'owner' WHERE league_id = ? AND user_id = ?`, [
      leagueId,
      nextOwnerId,
    ])
    await conn.execute('UPDATE leagues SET owner_user_id = ? WHERE id = ?', [nextOwnerId, leagueId])
    await deactivateLeagueMember(conn, leagueId, userId)

    await conn.commit()
    return res.json({ message: 'Left league', data: { leagueId, userId, newOwnerUserId: nextOwnerId } })
  } catch (error) {
    await conn.rollback()
    return handleSqlError(res, error)
  } finally {
    conn.release()
  }
})

router.patch('/:leagueId/members/:userId/role', async (req, res) => {
  const leagueId = Number.parseInt(req.params.leagueId, 10)
  const userId = Number.parseInt(req.params.userId, 10)
  const { role, actingUserId } = req.body
  const validRoles = ['owner', 'manager', 'player']

  if (Number.isNaN(leagueId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid leagueId or userId' })
  }
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: 'role must be owner, manager, or player' })
  }

  const actorId = Number.parseInt(String(actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  try {
    const leagues = await query('SELECT id, owner_user_id FROM leagues WHERE id = ? LIMIT 1', [leagueId])
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }
    const primaryOwnerUserId = Number(leagues[0].owner_user_id)

    const actorRows = await query(
      `SELECT role FROM league_members WHERE league_id = ? AND user_id = ? AND is_active = TRUE LIMIT 1`,
      [leagueId, actorId],
    )
    const actorLeagueRole = actorRows[0]?.role ? String(actorRows[0].role).toLowerCase() : ''
    const canAct =
      actorLeagueRole === 'owner' ||
      (!Number.isNaN(primaryOwnerUserId) && actorId === primaryOwnerUserId)
    if (!canAct) {
      return res.status(403).json({ error: 'Only league owners can change member roles.' })
    }

    const targetRows = await query(
      'SELECT user_id, role FROM league_members WHERE league_id = ? AND user_id = ? AND is_active = TRUE LIMIT 1',
      [leagueId, userId],
    )
    if (!targetRows.length) {
      return res.status(404).json({ error: 'League member not found' })
    }
    const targetRole = String(targetRows[0].role || '').toLowerCase()

    if (role === 'owner') {
      if (targetRole === 'owner') {
        return res.json({ message: 'No change', data: { leagueId, userId, role: 'owner' } })
      }
      await query(`UPDATE league_members SET role = 'owner' WHERE league_id = ? AND user_id = ?`, [
        leagueId,
        userId,
      ])
      return res.json({
        message: 'Member promoted to owner',
        data: { leagueId, userId, role: 'owner' },
      })
    }

    if (targetRole === 'owner') {
      const countRows = await query(
        `SELECT COUNT(*) AS c FROM league_members WHERE league_id = ? AND role = 'owner' AND is_active = TRUE`,
        [leagueId],
      )
      const ownerCount = Number(countRows[0]?.c) || 0
      if (ownerCount <= 1) {
        return res.status(400).json({
          error: 'At least one league owner is required. Promote another member to owner first.',
        })
      }
    }

    const result = await query(
      `UPDATE league_members
       SET role = ?
       WHERE league_id = ? AND user_id = ?`,
      [role, leagueId, userId],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'League member not found' })
    }

    if (userId === primaryOwnerUserId && role !== 'owner') {
      const nextOwner = await query(
        `SELECT user_id FROM league_members WHERE league_id = ? AND role = 'owner' AND user_id <> ? AND is_active = TRUE LIMIT 1`,
        [leagueId, userId],
      )
      if (nextOwner.length) {
        await query('UPDATE leagues SET owner_user_id = ? WHERE id = ?', [nextOwner[0].user_id, leagueId])
      }
    }

    return res.json({ message: 'Member role updated', data: { leagueId, userId, role } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
