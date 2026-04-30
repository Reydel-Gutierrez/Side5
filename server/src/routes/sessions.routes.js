const express = require('express')
const { query, pool } = require('../db/pool')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

function isMissingAvatarColumn(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' && String(error?.message || '').includes('avatar_image')
}

async function querySessionPlayersWithOptionalAvatar(sessionId) {
  const sqlWith = `SELECT sp.user_id, sp.status, sp.confirmed_at,
              u.username, u.display_name, u.base_value, u.rating, u.avatar_image
       FROM session_players sp
       INNER JOIN users u ON sp.user_id = u.id
       WHERE sp.session_id = ?
       ORDER BY sp.confirmed_at DESC`
  const sqlWithout = `SELECT sp.user_id, sp.status, sp.confirmed_at,
              u.username, u.display_name, u.base_value, u.rating, '' AS avatar_image
       FROM session_players sp
       INNER JOIN users u ON sp.user_id = u.id
       WHERE sp.session_id = ?
       ORDER BY sp.confirmed_at DESC`
  try {
    return await query(sqlWith, [sessionId])
  } catch (error) {
    if (!isMissingAvatarColumn(error)) throw error
    return query(sqlWithout, [sessionId])
  }
}

/** League owners and managers may create/edit/delete session teams and assign captains. */
async function assertActorCanManageSessionTeams(actorId, sessionId) {
  const rows = await query(
    `SELECT lm.role AS league_role
     FROM sessions s
     INNER JOIN league_members lm ON lm.league_id = s.league_id AND lm.user_id = ?
     WHERE s.id = ?
     LIMIT 1`,
    [actorId, sessionId],
  )
  if (!rows.length) {
    return {
      ok: false,
      status: 404,
      error: 'Session not found or you are not a member of this league.',
    }
  }
  const role = String(rows[0].league_role || '').toLowerCase()
  if (role !== 'owner' && role !== 'manager') {
    return {
      ok: false,
      status: 403,
      error: 'Only league owners and managers can manage session teams.',
    }
  }
  return { ok: true, role }
}

/** Team captain or league owner/manager may add or remove drafted players (except removing the captain). */
async function assertActorCanDraftOrUndraftForTeam(actorId, sessionId, team) {
  if (Number(team.captain_user_id) === Number(actorId)) {
    return { ok: true }
  }
  const staff = await assertActorCanManageSessionTeams(actorId, sessionId)
  if (staff.ok) {
    return { ok: true }
  }
  return {
    ok: false,
    status: 403,
    error: 'Only this team captain or league staff can change the roster for this team.',
  }
}

/** Deletes one team and related matches/stat rows; conn must be inside a transaction. */
async function deleteTeamCascadeConn(conn, sessionId, teamId) {
  const [matchRows] = await conn.execute(
    'SELECT id FROM matches WHERE session_id = ? AND (team_a_id = ? OR team_b_id = ?)',
    [sessionId, teamId, teamId],
  )
  const rows = Array.isArray(matchRows) ? matchRows : []
  const matchIds = rows.map((r) => r.id).filter((id) => id != null)
  if (matchIds.length) {
    const ph = matchIds.map(() => '?').join(', ')
    await conn.execute(`DELETE FROM stat_submissions WHERE match_id IN (${ph})`, matchIds)
    await conn.execute(`DELETE FROM matches WHERE id IN (${ph})`, matchIds)
  }
  await conn.execute('DELETE FROM team_players WHERE team_id = ?', [teamId])
  await conn.execute('DELETE FROM teams WHERE id = ? AND session_id = ?', [teamId, sessionId])
}

async function deleteSessionCascade(conn, sessionId) {
  const [matchRows] = await conn.execute('SELECT id FROM matches WHERE session_id = ?', [sessionId])
  const matchIds = (Array.isArray(matchRows) ? matchRows : []).map((r) => r.id).filter((id) => id != null)
  if (matchIds.length) {
    const ph = matchIds.map(() => '?').join(', ')
    await conn.execute(`DELETE FROM stat_submissions WHERE match_id IN (${ph})`, matchIds)
    await conn.execute(`DELETE FROM matches WHERE id IN (${ph})`, matchIds)
  }
  await conn.execute('DELETE FROM stat_submissions WHERE session_id = ?', [sessionId])
  const [teamRows] = await conn.execute('SELECT id FROM teams WHERE session_id = ?', [sessionId])
  const teamIds = (Array.isArray(teamRows) ? teamRows : []).map((r) => r.id).filter((id) => id != null)
  if (teamIds.length) {
    const tph = teamIds.map(() => '?').join(', ')
    await conn.execute(`DELETE FROM team_players WHERE team_id IN (${tph})`, teamIds)
    await conn.execute(`DELETE FROM teams WHERE id IN (${tph})`, teamIds)
  }
  try {
    await conn.execute('DELETE FROM session_draft_rolls WHERE session_id = ?', [sessionId])
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error
  }
  await conn.execute('DELETE FROM session_players WHERE session_id = ?', [sessionId])
  await conn.execute('DELETE FROM sessions WHERE id = ?', [sessionId])
}

async function recalculateTeamBudgetUsedConn(conn, teamId) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(SUM(COALESCE(u.base_value, 0)), 0) AS total
     FROM team_players tp
     INNER JOIN users u ON u.id = tp.user_id
     WHERE tp.team_id = ?`,
    [teamId],
  )
  const total = Array.isArray(rows) && rows[0] ? Number(rows[0].total) || 0 : 0
  await conn.execute('UPDATE teams SET budget_used = ? WHERE id = ?', [total, teamId])
  return total
}

async function syncCaptainMembershipConn(conn, sessionId, teamId, nextCaptainId) {
  const [existingRows] = await conn.execute('SELECT captain_user_id FROM teams WHERE id = ? AND session_id = ? LIMIT 1', [
    teamId,
    sessionId,
  ])
  const prevCaptainId = Array.isArray(existingRows) && existingRows[0] ? existingRows[0].captain_user_id : null

  if (prevCaptainId != null && nextCaptainId !== prevCaptainId) {
    await conn.execute('DELETE FROM team_players WHERE team_id = ? AND user_id = ?', [teamId, prevCaptainId])
  }
  if (nextCaptainId != null) {
    await conn.execute(
      `INSERT IGNORE INTO team_players (team_id, user_id, pick_source) VALUES (?, ?, 'captain')`,
      [teamId, nextCaptainId],
    )
  }
  return recalculateTeamBudgetUsedConn(conn, teamId)
}

async function assertActorCanManageLeague(actorId, leagueId) {
  const rows = await query(
    `SELECT role FROM league_members WHERE league_id = ? AND user_id = ? LIMIT 1`,
    [leagueId, actorId],
  )
  if (!rows.length) {
    return {
      ok: false,
      status: 404,
      error: 'League not found or you are not a member of this league.',
    }
  }
  const role = String(rows[0].role || '').toLowerCase()
  if (role !== 'owner' && role !== 'manager') {
    return {
      ok: false,
      status: 403,
      error: 'Only league owners and managers can create or edit sessions.',
    }
  }
  return { ok: true, role }
}

const SESSION_STATUSES = new Set(['open', 'draft_pending', 'drafting', 'locked', 'completed'])

const DEFAULT_SESSION_TEAMS = [{ name: 'Side A' }, { name: 'Side B' }]

let ensuredDraftSchema = false

function isDuplicateColumnError(error) {
  return error?.code === 'ER_DUP_FIELDNAME' || String(error?.message || '').includes('Duplicate column name')
}

async function ensureDraftSchema() {
  if (ensuredDraftSchema) return
  const alters = [
    'ALTER TABLE teams ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE sessions ADD COLUMN bench_shuffle_done TINYINT(1) NOT NULL DEFAULT 0',
    "ALTER TABLE team_players ADD COLUMN pick_source VARCHAR(32) NOT NULL DEFAULT 'captain'",
  ]
  for (const sql of alters) {
    try {
      await query(sql)
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error
    }
  }
  ensuredDraftSchema = true
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/** Minimum roster size per team to lock (from session format, e.g. 5v5 → 5). */
function minPlayersPerTeamFromSessionFormat(formatRaw) {
  const s = String(formatRaw || '5v5').trim().toLowerCase()
  const m = s.match(/^(\d+)\s*v\s*(\d+)$/i)
  if (m) {
    return Math.max(Number.parseInt(m[1], 10) || 0, Number.parseInt(m[2], 10) || 0) || 5
  }
  const single = s.match(/^(\d+)$/)
  if (single) return Number.parseInt(single[1], 10) || 5
  return 5
}

async function countRosterPlayersOnTeamConn(conn, teamId, captainUserId) {
  const [rows] = await conn.execute(
    `SELECT COUNT(DISTINCT tp.user_id) AS c FROM team_players tp WHERE tp.team_id = ?`,
    [teamId],
  )
  let c = Number(rows?.[0]?.c) || 0
  if (captainUserId != null) {
    const [capRows] = await conn.execute(
      'SELECT 1 FROM team_players WHERE team_id = ? AND user_id = ? LIMIT 1',
      [teamId, captainUserId],
    )
    if (!capRows.length) c += 1
  }
  return c
}

async function maybeRunBenchShuffleAllTeamsLockedConn(conn, sessionId) {
  const [unlockedRows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM teams WHERE session_id = ? AND COALESCE(is_locked, 0) = 0`,
    [sessionId],
  )
  const unlocked = Number(unlockedRows?.[0]?.c) || 0
  if (unlocked > 0) {
    return { ran: false, reason: 'not_all_locked' }
  }

  const [[sess]] = await conn.execute(
    'SELECT COALESCE(bench_shuffle_done, 0) AS bench_shuffle_done, budget_per_team FROM sessions WHERE id = ? FOR UPDATE',
    [sessionId],
  )
  if (Number(sess?.bench_shuffle_done) === 1) {
    return { ran: false, reason: 'already_shuffled' }
  }

  const maxBudget = Number(sess?.budget_per_team) || 0

  const [teamRows] = await conn.execute(`SELECT id FROM teams WHERE session_id = ? ORDER BY id ASC`, [sessionId])
  const teamIds = teamRows.map((r) => Number(r.id))
  if (!teamIds.length) {
    await conn.execute('UPDATE sessions SET bench_shuffle_done = 1 WHERE id = ?', [sessionId])
    return { ran: true, assigned: 0 }
  }

  const [pending] = await conn.execute(
    `SELECT sp.user_id, COALESCE(u.base_value, 0) AS base_value
     FROM session_players sp
     INNER JOIN users u ON u.id = sp.user_id
     WHERE sp.session_id = ? AND sp.status = 'confirmed'
       AND NOT EXISTS (
         SELECT 1 FROM team_players tp
         INNER JOIN teams t ON t.id = tp.team_id
         WHERE t.session_id = ? AND tp.user_id = sp.user_id
       )`,
    [sessionId, sessionId],
  )
  const poolPlayers = pending.map((r) => ({ userId: Number(r.user_id), cost: Number(r.base_value) || 0 }))
  shuffleInPlace(poolPlayers)

  for (const p of poolPlayers) {
    const order = shuffleInPlace([...teamIds])
    let placed = false
    for (const tid of order) {
      await conn.execute('SELECT id FROM teams WHERE id = ? AND session_id = ? FOR UPDATE', [tid, sessionId])
      const [brows] = await conn.execute('SELECT COALESCE(budget_used, 0) AS u FROM teams WHERE id = ? LIMIT 1', [tid])
      const used = Number(brows?.[0]?.u) || 0
      if (used + p.cost <= maxBudget) {
        await conn.execute(
          `INSERT INTO team_players (team_id, user_id, pick_source) VALUES (?, ?, 'bench_shuffle')`,
          [tid, p.userId],
        )
        await recalculateTeamBudgetUsedConn(conn, tid)
        placed = true
        break
      }
    }
    if (!placed && order.length) {
      const tid = order[0]
      await conn.execute('SELECT id FROM teams WHERE id = ? AND session_id = ? FOR UPDATE', [tid, sessionId])
      await conn.execute(
        `INSERT INTO team_players (team_id, user_id, pick_source) VALUES (?, ?, 'bench_shuffle')`,
        [tid, p.userId],
      )
      await recalculateTeamBudgetUsedConn(conn, tid)
    }
  }

  await conn.execute('UPDATE sessions SET bench_shuffle_done = 1 WHERE id = ?', [sessionId])
  return { ran: true, assigned: poolPlayers.length }
}

function normalizeTeamsOnCreate(raw) {
  if (raw == null) return DEFAULT_SESSION_TEAMS
  let arr = Array.isArray(raw) ? raw : null
  if (!arr && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      arr = Array.isArray(parsed) ? parsed : null
    } catch {
      arr = null
    }
  }
  if (!Array.isArray(arr) || !arr.length) return DEFAULT_SESSION_TEAMS
  const out = []
  for (const item of arr.slice(0, 8)) {
    const nameRaw = typeof item === 'string' ? item : item?.name
    const t = String(nameRaw ?? '')
      .trim()
      .slice(0, 50)
    if (t) out.push({ name: t })
  }
  if (out.length < 2) return DEFAULT_SESSION_TEAMS
  return out
}

function normalizeSqlTime(value) {
  const s = String(value ?? '').trim()
  if (!s) return null
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s
  return s.length >= 8 ? s.slice(0, 8) : `${s}:00`
}

function toSqlDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

router.get('/', async (_req, res) => {
  try {
    const sessions = await query(
      `SELECT s.id, s.league_id, s.title, s.session_date, s.session_time, s.location,
              s.format, s.budget_per_team, s.status, s.created_by_user_id, s.created_at,
              l.name AS league_name
       FROM sessions s
       INNER JOIN leagues l ON s.league_id = l.id
       ORDER BY s.session_date ASC, s.session_time ASC`
    )
    return res.json({ data: sessions, count: sessions.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/teams', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  try {
    const sessions = await query('SELECT id FROM sessions WHERE id = ? LIMIT 1', [sessionId])
    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const teams = await query(
      `SELECT id, session_id, name, captain_user_id, COALESCE(is_locked, 0) AS is_locked
       FROM teams
       WHERE session_id = ?
       ORDER BY id ASC`,
      [sessionId],
    )

    return res.json({ data: teams, count: teams.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/teams', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const { name, captainUserId, actingUserId } = req.body

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  const trimmedName = String(name || '').trim()
  if (!trimmedName) {
    return res.status(400).json({ error: 'Team name is required' })
  }
  const actorId = Number.parseInt(String(actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  try {
    const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error })
    }

    let captainId = null
    if (captainUserId !== undefined && captainUserId !== null && captainUserId !== '') {
      captainId = Number.parseInt(String(captainUserId), 10)
      if (Number.isNaN(captainId)) {
        return res.status(400).json({ error: 'Invalid captainUserId' })
      }
      const inLeague = await query(
        `SELECT 1 AS ok
         FROM league_members lm
         INNER JOIN sessions s ON s.league_id = lm.league_id
         WHERE s.id = ? AND lm.user_id = ?
         LIMIT 1`,
        [sessionId, captainId],
      )
      if (!inLeague.length) {
        return res.status(400).json({ error: 'Captain must be a member of this league.' })
      }
    }

    const result = await query(`INSERT INTO teams (session_id, name, captain_user_id) VALUES (?, ?, ?)`, [
      sessionId,
      trimmedName.slice(0, 50),
      captainId,
    ])

    return res.status(201).json({
      message: 'Team created',
      data: {
        id: result.insertId,
        session_id: sessionId,
        name: trimmedName.slice(0, 50),
        captain_user_id: captainId,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/:id/teams/:teamId/captain', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const { actingUserId, captainUserId } = req.body

  if (Number.isNaN(sessionId) || Number.isNaN(teamId)) {
    return res.status(400).json({ error: 'Invalid session or team id' })
  }

  const actorId = Number.parseInt(String(actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  let captainId = null
  if (captainUserId !== undefined && captainUserId !== null && captainUserId !== '') {
    captainId = Number.parseInt(String(captainUserId), 10)
    if (Number.isNaN(captainId)) {
      return res.status(400).json({ error: 'captainUserId must be a number or null' })
    }
  }

  try {
    await ensureDraftSchema()
    const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error })
    }

    const teams = await query(
      'SELECT id, COALESCE(is_locked, 0) AS is_locked FROM teams WHERE id = ? AND session_id = ? LIMIT 1',
      [teamId, sessionId],
    )
    if (!teams.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    if (Number(teams[0].is_locked) === 1) {
      return res.status(400).json({ error: 'Team is locked. Captain cannot be changed.' })
    }

    if (captainId !== null) {
      const inLeague = await query(
        `SELECT 1 AS ok
         FROM league_members lm
         INNER JOIN sessions s ON s.league_id = lm.league_id
         WHERE s.id = ? AND lm.user_id = ?
         LIMIT 1`,
        [sessionId, captainId],
      )
      if (!inLeague.length) {
        return res.status(400).json({ error: 'Captain must be a member of this league.' })
      }
    }

    const conn = await pool.getConnection()
    let budgetUsed = 0
    try {
      await conn.beginTransaction()
      await conn.execute('UPDATE teams SET captain_user_id = ? WHERE id = ? AND session_id = ?', [
        captainId,
        teamId,
        sessionId,
      ])
      budgetUsed = await syncCaptainMembershipConn(conn, sessionId, teamId, captainId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.json({
      message: 'Captain updated',
      data: { sessionId, teamId, captainUserId: captainId, budgetUsed },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/draft', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  try {
    await ensureDraftSchema()
    const sessions = await query(
      `SELECT s.id, s.league_id, s.title, s.budget_per_team, s.status, s.format,
              COALESCE(s.bench_shuffle_done, 0) AS bench_shuffle_done
       FROM sessions s
       WHERE s.id = ?
       LIMIT 1`,
      [sessionId],
    )
    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const teams = await query(
      `SELECT t.id, t.session_id, t.name, t.captain_user_id, COALESCE(t.budget_used, 0) AS budget_used,
              COALESCE(t.is_locked, 0) AS is_locked
       FROM teams t
       WHERE t.session_id = ?
       ORDER BY t.id ASC`,
      [sessionId],
    )

    const roster = await query(
      `SELECT sp.user_id, sp.status, u.username, u.display_name, u.base_value, u.rating, u.avatar_image
       FROM session_players sp
       INNER JOIN users u ON u.id = sp.user_id
       WHERE sp.session_id = ? AND sp.status = 'confirmed'
       ORDER BY u.display_name ASC, u.username ASC`,
      [sessionId],
    )

    const teamPlayers = await query(
      `SELECT tp.team_id, tp.user_id, COALESCE(tp.pick_source, 'captain') AS pick_source
       FROM team_players tp
       INNER JOIN teams t ON t.id = tp.team_id
       WHERE t.session_id = ?`,
      [sessionId],
    )

    const assigned = new Set()
    teams.forEach((t) => {
      if (t?.captain_user_id != null) assigned.add(Number(t.captain_user_id))
    })
    teamPlayers.forEach((tp) => {
      if (tp?.user_id != null) assigned.add(Number(tp.user_id))
    })
    const unassignedBenchCount = roster.filter((r) => !assigned.has(Number(r.user_id))).length

    const benchShuffleAssignments = teamPlayers
      .filter((tp) => String(tp.pick_source || 'captain') === 'bench_shuffle')
      .map((tp) => ({ teamId: Number(tp.team_id), userId: Number(tp.user_id) }))

    const minPlayersPerTeamToLock = minPlayersPerTeamFromSessionFormat(sessions[0]?.format)

    return res.json({
      data: {
        session: sessions[0],
        teams,
        roster,
        teamPlayers,
        benchShuffleAssignments,
        unassignedBenchCount,
        minPlayersPerTeamToLock,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/teams/:teamId/players', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const actorId = Number.parseInt(String(req.body?.actingUserId ?? ''), 10)
  const userId = Number.parseInt(String(req.body?.userId ?? ''), 10)

  if (Number.isNaN(sessionId) || Number.isNaN(teamId)) {
    return res.status(400).json({ error: 'Invalid session or team id' })
  }
  if (Number.isNaN(actorId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'actingUserId and userId are required and must be numbers' })
  }

  try {
    await ensureDraftSchema()
    const teamRows = await query(
      `SELECT t.id, t.name, t.captain_user_id, s.budget_per_team, COALESCE(t.is_locked, 0) AS is_locked
       FROM teams t
       INNER JOIN sessions s ON s.id = t.session_id
       WHERE t.id = ? AND t.session_id = ?
       LIMIT 1`,
      [teamId, sessionId],
    )
    if (!teamRows.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    const team = teamRows[0]
    if (Number(team.is_locked) === 1) {
      return res.status(400).json({ error: 'This team is locked. Roster changes are not allowed.' })
    }
    const auth = await assertActorCanDraftOrUndraftForTeam(actorId, sessionId, team)
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }

    const confirmedRows = await query(
      `SELECT 1 AS ok FROM session_players
       WHERE session_id = ? AND user_id = ? AND status = 'confirmed'
       LIMIT 1`,
      [sessionId, userId],
    )
    if (!confirmedRows.length) {
      return res.status(400).json({ error: 'Player must be confirmed in this session.' })
    }

    const alreadyInSession = await query(
      `SELECT tp.id
       FROM team_players tp
       INNER JOIN teams t ON t.id = tp.team_id
       WHERE t.session_id = ? AND tp.user_id = ?
       LIMIT 1`,
      [sessionId, userId],
    )
    if (alreadyInSession.length) {
      return res.status(409).json({ error: 'Player is already assigned to a team in this session.' })
    }

    const conn = await pool.getConnection()
    let budgetUsed = 0
    try {
      await conn.beginTransaction()
      const [userRows] = await conn.execute('SELECT COALESCE(base_value, 0) AS base_value FROM users WHERE id = ? LIMIT 1', [userId])
      const playerCost = Array.isArray(userRows) && userRows[0] ? Number(userRows[0].base_value) || 0 : 0
      const [budgetRows] = await conn.execute('SELECT COALESCE(budget_used, 0) AS budget_used FROM teams WHERE id = ? LIMIT 1 FOR UPDATE', [
        teamId,
      ])
      const used = Array.isArray(budgetRows) && budgetRows[0] ? Number(budgetRows[0].budget_used) || 0 : 0
      const maxBudget = Number(team.budget_per_team) || 0
      if (used + playerCost > maxBudget) {
        await conn.rollback()
        return res.status(400).json({ error: 'Budget exceeded for this team.' })
      }

      await conn.execute(
        `INSERT INTO team_players (team_id, user_id, pick_source) VALUES (?, ?, 'captain')`,
        [teamId, userId],
      )
      budgetUsed = await recalculateTeamBudgetUsedConn(conn, teamId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.status(201).json({
      message: 'Player drafted',
      data: { sessionId, teamId, userId, budgetUsed },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.delete('/:id/teams/:teamId/players/:userId', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const userId = Number.parseInt(req.params.userId, 10)
  const actorId = Number.parseInt(String(req.body?.actingUserId ?? req.query?.actingUserId ?? ''), 10)

  if (Number.isNaN(sessionId) || Number.isNaN(teamId) || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid session, team, or user id' })
  }
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  try {
    await ensureDraftSchema()
    const teamRows = await query(
      `SELECT t.id, t.captain_user_id, COALESCE(t.is_locked, 0) AS is_locked
       FROM teams t
       WHERE t.id = ? AND t.session_id = ?
       LIMIT 1`,
      [teamId, sessionId],
    )
    if (!teamRows.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    const team = teamRows[0]
    if (Number(team.is_locked) === 1) {
      return res.status(400).json({ error: 'This team is locked. Roster changes are not allowed.' })
    }
    const auth = await assertActorCanDraftOrUndraftForTeam(actorId, sessionId, team)
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }
    if (team.captain_user_id != null && Number(team.captain_user_id) === userId) {
      return res.status(400).json({ error: 'Captain cannot be removed from their own team.' })
    }

    const conn = await pool.getConnection()
    let budgetUsed = 0
    try {
      await conn.beginTransaction()
      const [deleteResult] = await conn.execute('DELETE FROM team_players WHERE team_id = ? AND user_id = ?', [teamId, userId])
      if (!deleteResult?.affectedRows) {
        await conn.rollback()
        return res.status(404).json({ error: 'Player is not drafted on this team.' })
      }
      budgetUsed = await recalculateTeamBudgetUsedConn(conn, teamId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.json({
      message: 'Player undrafted',
      data: { sessionId, teamId, userId, budgetUsed },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/teams/:teamId/lock', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const actorId = Number.parseInt(String(req.body?.actingUserId ?? ''), 10)
  if (Number.isNaN(sessionId) || Number.isNaN(teamId) || Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'Invalid session, team, or actingUserId' })
  }
  try {
    await ensureDraftSchema()
    const teamRows = await query(
      `SELECT t.id, t.captain_user_id, COALESCE(t.is_locked, 0) AS is_locked
       FROM teams t
       WHERE t.id = ? AND t.session_id = ?
       LIMIT 1`,
      [teamId, sessionId],
    )
    if (!teamRows.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    const team = teamRows[0]
    if (Number(team.is_locked) === 1) {
      return res.status(409).json({ error: 'Team is already locked.' })
    }
    const isCaptain = team.captain_user_id != null && Number(team.captain_user_id) === actorId
    if (!isCaptain) {
      return res.status(403).json({ error: 'Only this team captain can lock the team.' })
    }

    const conn = await pool.getConnection()
    let shuffleResult = { ran: false }
    try {
      await conn.beginTransaction()
      const [[sessRow]] = await conn.execute(
        'SELECT format FROM sessions WHERE id = ? FOR UPDATE',
        [sessionId],
      )
      const minNeed = minPlayersPerTeamFromSessionFormat(sessRow?.format)
      const rosterCount = await countRosterPlayersOnTeamConn(conn, teamId, team.captain_user_id)
      if (rosterCount < minNeed) {
        await conn.rollback()
        return res.status(400).json({
          error: `You need at least ${minNeed} players on this team (including captain) before locking.`,
        })
      }
      await conn.execute('UPDATE teams SET is_locked = 1 WHERE id = ? AND session_id = ?', [teamId, sessionId])
      shuffleResult = await maybeRunBenchShuffleAllTeamsLockedConn(conn, sessionId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    const countRows = await query(
      `SELECT COUNT(*) AS c FROM teams WHERE session_id = ? AND COALESCE(is_locked, 0) = 0`,
      [sessionId],
    )
    const unlockedRemaining = Number(countRows?.[0]?.c) || 0

    return res.json({
      message: 'Team locked',
      data: {
        sessionId,
        teamId,
        allTeamsLocked: unlockedRemaining === 0,
        benchShuffle: shuffleResult,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/teams/:teamId/unlock', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const actorId = Number.parseInt(String(req.body?.actingUserId ?? ''), 10)
  if (Number.isNaN(sessionId) || Number.isNaN(teamId) || Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'Invalid session, team, or actingUserId' })
  }
  try {
    await ensureDraftSchema()
    const sessionRows = await query(
      'SELECT COALESCE(bench_shuffle_done, 0) AS bench_shuffle_done FROM sessions WHERE id = ? LIMIT 1',
      [sessionId],
    )
    if (!sessionRows.length) {
      return res.status(404).json({ error: 'Session not found' })
    }
    if (Number(sessionRows[0].bench_shuffle_done) === 1) {
      return res.status(400).json({ error: 'Bench players have already been auto-assigned. Unlock is not allowed.' })
    }

    const teamRows = await query(
      `SELECT t.id, t.captain_user_id, COALESCE(t.is_locked, 0) AS is_locked
       FROM teams t
       WHERE t.id = ? AND t.session_id = ?
       LIMIT 1`,
      [teamId, sessionId],
    )
    if (!teamRows.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    const team = teamRows[0]
    if (Number(team.is_locked) !== 1) {
      return res.status(400).json({ error: 'Team is not locked.' })
    }
    const isCaptain = team.captain_user_id != null && Number(team.captain_user_id) === actorId
    if (!isCaptain) {
      return res.status(403).json({ error: 'Only this team captain can unlock the team.' })
    }

    await query('UPDATE teams SET is_locked = 0 WHERE id = ? AND session_id = ?', [teamId, sessionId])
    return res.json({ message: 'Team unlocked', data: { sessionId, teamId } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/:id/teams/:teamId', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const { name, captainUserId, actingUserId } = req.body

  if (Number.isNaN(sessionId) || Number.isNaN(teamId)) {
    return res.status(400).json({ error: 'Invalid session or team id' })
  }
  const actorId = Number.parseInt(String(actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  const hasName = name !== undefined
  const hasCaptain = Object.prototype.hasOwnProperty.call(req.body, 'captainUserId')
  if (!hasName && !hasCaptain) {
    return res.status(400).json({ error: 'Provide name and/or captainUserId to update' })
  }

  try {
    const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error })
    }

    const teams = await query(
      'SELECT id, COALESCE(is_locked, 0) AS is_locked FROM teams WHERE id = ? AND session_id = ? LIMIT 1',
      [teamId, sessionId],
    )
    if (!teams.length) {
      return res.status(404).json({ error: 'Team not found' })
    }
    if (Number(teams[0].is_locked) === 1) {
      return res.status(400).json({ error: 'Team is locked and cannot be edited.' })
    }

    let captainId
    if (hasCaptain) {
      if (captainUserId === null || captainUserId === '') {
        captainId = null
      } else {
        captainId = Number.parseInt(String(captainUserId), 10)
        if (Number.isNaN(captainId)) {
          return res.status(400).json({ error: 'Invalid captainUserId' })
        }
        const inLeague = await query(
          `SELECT 1 AS ok
           FROM league_members lm
           INNER JOIN sessions s ON s.league_id = lm.league_id
           WHERE s.id = ? AND lm.user_id = ?
           LIMIT 1`,
          [sessionId, captainId],
        )
        if (!inLeague.length) {
          return res.status(400).json({ error: 'Captain must be a member of this league.' })
        }
      }
    }

    const sets = []
    const vals = []
    if (hasName) {
      const trimmed = String(name).trim()
      if (!trimmed) {
        return res.status(400).json({ error: 'Team name cannot be empty' })
      }
      sets.push('name = ?')
      vals.push(trimmed.slice(0, 50))
    }
    if (hasCaptain) {
      sets.push('captain_user_id = ?')
      vals.push(captainId)
    }
    vals.push(teamId, sessionId)
    await query(`UPDATE teams SET ${sets.join(', ')} WHERE id = ? AND session_id = ?`, vals)

    return res.json({
      message: 'Team updated',
      data: { sessionId, teamId },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.delete('/:id/teams/:teamId', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const teamId = Number.parseInt(req.params.teamId, 10)
  const actingUserId = req.body?.actingUserId
  const actorId = Number.parseInt(String(actingUserId ?? ''), 10)

  if (Number.isNaN(sessionId) || Number.isNaN(teamId)) {
    return res.status(400).json({ error: 'Invalid session or team id' })
  }
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  try {
    const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error })
    }

    const teams = await query('SELECT id FROM teams WHERE id = ? AND session_id = ? LIMIT 1', [teamId, sessionId])
    if (!teams.length) {
      return res.status(404).json({ error: 'Team not found' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await deleteTeamCascadeConn(conn, sessionId, teamId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.json({ message: 'Team deleted', data: { sessionId, teamId } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.delete('/:id', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  const actorId = Number.parseInt(String(req.body?.actingUserId ?? req.query?.actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required (body or query) and must be a number' })
  }

  try {
    const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error })
    }

    const sessions = await query('SELECT id FROM sessions WHERE id = ? LIMIT 1', [sessionId])
    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await deleteSessionCascade(conn, sessionId)
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.json({ message: 'Session deleted', data: { id: sessionId } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  try {
    const sessions = await query(
      `SELECT s.id, s.league_id, s.title, s.session_date, s.session_time, s.location,
              s.format, s.budget_per_team, s.status, s.created_by_user_id, s.created_at,
              l.name AS league_name
       FROM sessions s
       INNER JOIN leagues l ON s.league_id = l.id
       WHERE s.id = ?
       LIMIT 1`,
      [sessionId]
    )

    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const players = await querySessionPlayersWithOptionalAvatar(sessionId)

    return res.json({ data: { ...sessions[0], players } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/:id', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  const actorId = Number.parseInt(String(req.body?.actingUserId ?? ''), 10)
  if (Number.isNaN(actorId)) {
    return res.status(400).json({ error: 'actingUserId is required and must be a number' })
  }

  const gate = await assertActorCanManageSessionTeams(actorId, sessionId)
  if (!gate.ok) {
    return res.status(gate.status).json({ error: gate.error })
  }

  const titleRaw = req.body.title ?? req.body.sessionTitle
  const sessionDateRaw = req.body.sessionDate ?? req.body.session_date
  const sessionTimeRaw = req.body.sessionTime ?? req.body.session_time
  const locationRaw = req.body.location
  const formatRaw = req.body.format
  const budgetRaw = req.body.budgetPerTeam ?? req.body.budget_per_team
  const statusRaw = req.body.status

  const sets = []
  const vals = []

  if (titleRaw !== undefined) {
    const trimmed = String(titleRaw).trim()
    if (!trimmed) {
      return res.status(400).json({ error: 'title cannot be empty' })
    }
    sets.push('title = ?')
    vals.push(trimmed.slice(0, 100))
  }
  if (sessionDateRaw !== undefined) {
    const d = toSqlDate(sessionDateRaw)
    if (!d) {
      return res.status(400).json({ error: 'Invalid sessionDate' })
    }
    sets.push('session_date = ?')
    vals.push(d)
  }
  if (sessionTimeRaw !== undefined) {
    const t = normalizeSqlTime(sessionTimeRaw)
    if (!t) {
      return res.status(400).json({ error: 'Invalid sessionTime' })
    }
    sets.push('session_time = ?')
    vals.push(t)
  }
  if (locationRaw !== undefined) {
    sets.push('location = ?')
    vals.push(locationRaw === null || locationRaw === '' ? null : String(locationRaw).slice(0, 100))
  }
  if (formatRaw !== undefined) {
    sets.push('format = ?')
    vals.push(String(formatRaw || '5v5').slice(0, 20))
  }
  if (budgetRaw !== undefined) {
    const n = Number(budgetRaw)
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: 'Invalid budgetPerTeam' })
    }
    sets.push('budget_per_team = ?')
    vals.push(n)
  }
  if (statusRaw !== undefined) {
    const st = String(statusRaw).trim()
    if (!SESSION_STATUSES.has(st)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    sets.push('status = ?')
    vals.push(st)
  }

  const teamsBody = req.body.teams
  const hasTeams = teamsBody !== undefined

  if (!sets.length && !hasTeams) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  try {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      if (sets.length) {
        vals.push(sessionId)
        await conn.execute(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, vals)
      }
      if (hasTeams) {
        const newNorm = normalizeTeamsOnCreate(teamsBody)
        const [existingRows] = await conn.execute(
          'SELECT id FROM teams WHERE session_id = ? ORDER BY id ASC',
          [sessionId],
        )
        const existingIds = (Array.isArray(existingRows) ? existingRows : []).map((r) => r.id)
        for (let i = 0; i < newNorm.length; i += 1) {
          const nm = newNorm[i].name.slice(0, 50)
          if (i < existingIds.length) {
            await conn.execute('UPDATE teams SET name = ? WHERE id = ? AND session_id = ?', [
              nm,
              existingIds[i],
              sessionId,
            ])
          } else {
            await conn.execute('INSERT INTO teams (session_id, name, captain_user_id) VALUES (?, ?, NULL)', [
              sessionId,
              nm,
            ])
          }
        }
        for (let j = newNorm.length; j < existingIds.length; j += 1) {
          await deleteTeamCascadeConn(conn, sessionId, existingIds[j])
        }
      }
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }
    return res.json({ message: 'Session updated', data: { id: sessionId } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/', async (req, res) => {
  const {
    leagueId,
    title,
    sessionDate,
    sessionTime,
    location,
    format,
    budgetPerTeam,
    status,
    createdByUserId,
    teams: teamsBody,
  } = req.body

  if (!leagueId || !title || !sessionDate || !sessionTime || !createdByUserId) {
    return res.status(400).json({
      error: 'leagueId, title, sessionDate, sessionTime, and createdByUserId are required',
    })
  }

  const leagueIdNum = Number.parseInt(String(leagueId), 10)
  const creatorId = Number.parseInt(String(createdByUserId), 10)
  if (Number.isNaN(leagueIdNum) || Number.isNaN(creatorId)) {
    return res.status(400).json({ error: 'leagueId and createdByUserId must be numbers' })
  }

  const teamsNorm = normalizeTeamsOnCreate(teamsBody)

  try {
    const leagues = await query('SELECT id FROM leagues WHERE id = ? LIMIT 1', [leagueIdNum])
    if (!leagues.length) {
      return res.status(404).json({ error: 'League not found' })
    }

    const users = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [creatorId])
    if (!users.length) {
      return res.status(404).json({ error: 'Creator user not found' })
    }

    const perm = await assertActorCanManageLeague(creatorId, leagueIdNum)
    if (!perm.ok) {
      return res.status(perm.status).json({ error: perm.error })
    }

    const sqlTime = normalizeSqlTime(sessionTime)
    const sqlDate = toSqlDate(sessionDate)
    if (!sqlTime || !sqlDate) {
      return res.status(400).json({ error: 'Invalid sessionDate or sessionTime' })
    }

    const statusVal = status ? String(status).trim() : 'open'
    if (!SESSION_STATUSES.has(statusVal)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const conn = await pool.getConnection()
    let newSessionId
    try {
      await conn.beginTransaction()
      const [insertResult] = await conn.execute(
        `INSERT INTO sessions
        (league_id, title, session_date, session_time, location, format, budget_per_team, status, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leagueIdNum,
          String(title).trim().slice(0, 100),
          sqlDate,
          sqlTime,
          location || null,
          format || '5v5',
          budgetPerTeam || 50.0,
          statusVal,
          creatorId,
        ],
      )
      newSessionId = insertResult.insertId
      for (const t of teamsNorm) {
        await conn.execute('INSERT INTO teams (session_id, name, captain_user_id) VALUES (?, ?, NULL)', [
          newSessionId,
          t.name.slice(0, 50),
        ])
      }
      await conn.commit()
    } catch (innerErr) {
      await conn.rollback()
      throw innerErr
    } finally {
      conn.release()
    }

    return res.status(201).json({
      message: 'Session created',
      data: {
        id: newSessionId,
        league_id: leagueIdNum,
        title,
        session_date: sqlDate,
        session_time: sqlTime,
        teams: teamsNorm,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/confirm', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const { userId } = req.body

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const sessions = await query('SELECT id FROM sessions WHERE id = ? LIMIT 1', [sessionId])
    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const users = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }

    await query(
      `INSERT INTO session_players (session_id, user_id, status, confirmed_at)
       VALUES (?, ?, 'confirmed', NOW())
       ON DUPLICATE KEY UPDATE
         status = 'confirmed',
         confirmed_at = NOW()`,
      [sessionId, userId]
    )

    return res.json({ message: 'Player confirmed', data: { sessionId, userId, status: 'confirmed' } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
