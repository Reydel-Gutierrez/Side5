const { query, pool } = require('../db/pool')
const {
  LM_RATING_SQL,
  LM_WORTH_SQL,
  LM_OVR_SQL,
  leagueMemberJoinForTeamSession,
} = require('../queries/leagueMemberStats')

let ensuredGameHubSchema = false

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE'
}

async function ensureGameHubSchema() {
  if (ensuredGameHubSchema) return
  await query(`
    CREATE TABLE IF NOT EXISTS player_stat_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      league_id INT NOT NULL,
      user_id INT NOT NULL,
      goals INT NOT NULL DEFAULT 0,
      result ENUM('win', 'loss') NOT NULL,
      note TEXT NULL,
      status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_session_user (session_id, user_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS player_stat_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submission_id INT NOT NULL,
      reviewer_user_id INT NOT NULL,
      decision ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
      decline_note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_submission_reviewer (submission_id, reviewer_user_id),
      FOREIGN KEY (submission_id) REFERENCES player_stat_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_user_id) REFERENCES users(id)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS player_stat_review_slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      reviewer_user_id INT NOT NULL,
      target_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_session_reviewer_target (session_id, reviewer_user_id, target_user_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_user_id) REFERENCES users(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id)
    )
  `)
  ensuredGameHubSchema = true
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

async function allTeamsLocked(sessionId) {
  const rows = await query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN COALESCE(is_locked, 0) = 1 THEN 1 ELSE 0 END) AS locked_count
     FROM teams WHERE session_id = ?`,
    [sessionId],
  )
  const total = Number(rows[0]?.total) || 0
  const locked = Number(rows[0]?.locked_count) || 0
  return total > 0 && locked === total
}

async function getSessionTeamPlayerIds(sessionId) {
  const rows = await query(
    `SELECT DISTINCT uid AS user_id FROM (
       SELECT tp.user_id AS uid
       FROM team_players tp
       INNER JOIN teams t ON t.id = tp.team_id
       WHERE t.session_id = ?
       UNION
       SELECT t.captain_user_id AS uid
       FROM teams t
       WHERE t.session_id = ? AND t.captain_user_id IS NOT NULL
     ) x
     WHERE uid IS NOT NULL`,
    [sessionId, sessionId],
  )
  return rows.map((r) => Number(r.user_id)).filter((id) => !Number.isNaN(id))
}

async function userIsSessionTeamPlayer(sessionId, userId) {
  const ids = await getSessionTeamPlayerIds(sessionId)
  return ids.includes(Number(userId))
}

function pickTwoReviewers(playerIds, submitterUserId) {
  const eligible = playerIds.filter((id) => id !== Number(submitterUserId))
  if (eligible.length < 2) {
    return null
  }
  return shuffleInPlace([...eligible]).slice(0, 2)
}

async function assignReviewersConn(conn, submissionId, sessionId, submitterUserId) {
  const playerIds = await getSessionTeamPlayerIds(sessionId)
  const reviewers = pickTwoReviewers(playerIds, submitterUserId)
  if (!reviewers) {
    throw new Error('Not enough session players to assign two reviewers')
  }
  for (const reviewerId of reviewers) {
    await conn.execute(
      `INSERT INTO player_stat_reviews (submission_id, reviewer_user_id, decision)
       VALUES (?, ?, 'pending')`,
      [submissionId, reviewerId],
    )
  }
  return reviewers
}

async function resetReviewsConn(conn, submissionId, sessionId, submitterUserId) {
  await conn.execute('DELETE FROM player_stat_reviews WHERE submission_id = ?', [submissionId])
  const reviewers = await assignReviewersConn(conn, submissionId, sessionId, submitterUserId)
  await fulfillReviewSlotsForTargetConn(conn, sessionId, submitterUserId, submissionId)
  return reviewers
}

async function ensureReviewSlotsForUser(sessionId, reviewerUserId) {
  const existing = await query(
    `SELECT target_user_id FROM player_stat_review_slots
     WHERE session_id = ? AND reviewer_user_id = ?`,
    [sessionId, reviewerUserId],
  )
  if (existing.length >= 2) return

  const playerIds = await getSessionTeamPlayerIds(sessionId)
  const taken = new Set(existing.map((r) => Number(r.target_user_id)))
  const eligible = playerIds.filter((id) => id !== Number(reviewerUserId) && !taken.has(id))
  const needed = Math.min(2 - existing.length, eligible.length)
  if (needed <= 0) return

  const picked = shuffleInPlace([...eligible]).slice(0, needed)
  for (const targetId of picked) {
    await query(
      `INSERT IGNORE INTO player_stat_review_slots (session_id, reviewer_user_id, target_user_id)
       VALUES (?, ?, ?)`,
      [sessionId, reviewerUserId, targetId],
    )
  }
}

async function fulfillReviewSlotsForTargetConn(conn, sessionId, targetUserId, submissionId) {
  const [slots] = await conn.execute(
    `SELECT reviewer_user_id FROM player_stat_review_slots
     WHERE session_id = ? AND target_user_id = ?`,
    [sessionId, targetUserId],
  )
  const rows = Array.isArray(slots) ? slots : []
  for (const slot of rows) {
    const reviewerId = slot.reviewer_user_id
    const [existing] = await conn.execute(
      `SELECT id FROM player_stat_reviews
       WHERE submission_id = ? AND reviewer_user_id = ?
       LIMIT 1`,
      [submissionId, reviewerId],
    )
    if (!existing.length) {
      await conn.execute(
        `INSERT INTO player_stat_reviews (submission_id, reviewer_user_id, decision)
         VALUES (?, ?, 'pending')`,
        [submissionId, reviewerId],
      )
    }
  }
}

async function backfillSlotReviewsForReviewer(sessionId, reviewerUserId) {
  const missing = await query(
    `SELECT pss.id AS submission_id
     FROM player_stat_review_slots rs
     INNER JOIN player_stat_submissions pss
       ON pss.session_id = rs.session_id AND pss.user_id = rs.target_user_id
     LEFT JOIN player_stat_reviews psr
       ON psr.submission_id = pss.id AND psr.reviewer_user_id = rs.reviewer_user_id
     WHERE rs.session_id = ? AND rs.reviewer_user_id = ? AND psr.id IS NULL`,
    [sessionId, reviewerUserId],
  )
  for (const row of missing) {
    await query(
      `INSERT INTO player_stat_reviews (submission_id, reviewer_user_id, decision)
       VALUES (?, ?, 'pending')`,
      [row.submission_id, reviewerUserId],
    )
  }
}

async function getReviewAssignments(sessionId, reviewerUserId) {
  await ensureReviewSlotsForUser(sessionId, reviewerUserId)
  await backfillSlotReviewsForReviewer(sessionId, reviewerUserId)
  const rows = await query(
    `SELECT rs.id AS slot_id, rs.target_user_id,
            u.username AS target_username, u.display_name AS target_display_name,
            pss.id AS submission_id, pss.goals, pss.result, pss.note,
            pss.status AS submission_status,
            psr.id AS review_id, psr.decision AS review_decision
     FROM player_stat_review_slots rs
     INNER JOIN users u ON u.id = rs.target_user_id
     LEFT JOIN player_stat_submissions pss
       ON pss.session_id = rs.session_id AND pss.user_id = rs.target_user_id
     LEFT JOIN player_stat_reviews psr
       ON psr.submission_id = pss.id AND psr.reviewer_user_id = rs.reviewer_user_id
     WHERE rs.session_id = ? AND rs.reviewer_user_id = ?
     ORDER BY rs.id ASC`,
    [sessionId, reviewerUserId],
  )

  return rows.map((row) => {
    const hasSubmitted = row.submission_id != null
    const submissionPending = String(row.submission_status || '') === 'pending'
    const reviewPending = String(row.review_decision || 'pending') === 'pending'
    return {
      slot_id: row.slot_id,
      target_user_id: row.target_user_id,
      target_username: row.target_username,
      target_display_name: row.target_display_name,
      target_has_submitted: hasSubmitted,
      submission_id: row.submission_id,
      goals: row.goals,
      result: row.result,
      note: row.note,
      submission_status: row.submission_status,
      review_id: row.review_id,
      review_decision: row.review_decision,
      can_review: hasSubmitted && submissionPending && row.review_id != null && reviewPending,
    }
  })
}

async function fetchSubmissionWithReviews(submissionId) {
  const subs = await query(
    `SELECT pss.*, u.username, u.display_name
     FROM player_stat_submissions pss
     INNER JOIN users u ON u.id = pss.user_id
     WHERE pss.id = ?
     LIMIT 1`,
    [submissionId],
  )
  if (!subs.length) return null
  const reviews = await query(
    `SELECT psr.*, u.username AS reviewer_username, u.display_name AS reviewer_display_name
     FROM player_stat_reviews psr
     INNER JOIN users u ON u.id = psr.reviewer_user_id
     WHERE psr.submission_id = ?
     ORDER BY psr.id ASC`,
    [submissionId],
  )
  const declineNotes = reviews
    .filter((r) => r.decision === 'declined' && r.decline_note)
    .map((r) => r.decline_note)
  return {
    ...subs[0],
    reviews,
    decline_note: declineNotes[0] || null,
  }
}

async function applyLeagueMemberStatsConn(conn, leagueId, userId, goals, result) {
  const winInc = result === 'win' ? 1 : 0
  const lossInc = result === 'loss' ? 1 : 0
  await conn.execute(
    `UPDATE league_members
     SET matches_played = matches_played + 1,
         goals = goals + ?,
         wins = wins + ?,
         losses = losses + ?,
         updated_at = NOW()
     WHERE league_id = ? AND user_id = ? AND is_active = TRUE`,
    [goals, winInc, lossInc, leagueId, userId],
  )
}

async function processReviewsAfterDecisionConn(conn, submissionId) {
  const [subRows] = await conn.execute(
    'SELECT id, session_id, league_id, user_id, goals, result, status FROM player_stat_submissions WHERE id = ? LIMIT 1',
    [submissionId],
  )
  if (!subRows.length) return { status: 'not_found' }
  const sub = subRows[0]
  if (sub.status === 'approved') {
    return { status: 'already_approved' }
  }

  const [reviewRows] = await conn.execute(
    'SELECT id, decision FROM player_stat_reviews WHERE submission_id = ?',
    [submissionId],
  )
  const reviews = Array.isArray(reviewRows) ? reviewRows : []

  const anyDeclined = reviews.some((r) => r.decision === 'declined')
  if (anyDeclined) {
    await conn.execute(
      `UPDATE player_stat_submissions SET status = 'declined', updated_at = NOW() WHERE id = ?`,
      [submissionId],
    )
    return { status: 'declined' }
  }

  const allAccepted = reviews.length >= 2 && reviews.every((r) => r.decision === 'accepted')
  if (allAccepted) {
    await conn.execute(
      `UPDATE player_stat_submissions SET status = 'approved', updated_at = NOW() WHERE id = ?`,
      [submissionId],
    )
    await applyLeagueMemberStatsConn(conn, sub.league_id, sub.user_id, Number(sub.goals) || 0, sub.result)
    return { status: 'approved' }
  }

  return { status: 'pending' }
}

async function getLockedTeamsPayload(sessionId) {
  const teams = await query(
    `SELECT t.id, t.name, t.captain_user_id, COALESCE(t.budget_used, 0) AS budget_used,
            COALESCE(t.is_locked, 0) AS is_locked
     FROM teams t
     WHERE t.session_id = ?
     ORDER BY t.id ASC`,
    [sessionId],
  )

  const teamPlayers = await query(
    `SELECT tp.team_id, tp.user_id, u.username, u.display_name,
            ${LM_WORTH_SQL} AS player_worth,
            ${LM_RATING_SQL} AS rating,
            ${LM_OVR_SQL} AS ovr
     FROM team_players tp
     INNER JOIN teams t ON t.id = tp.team_id
     INNER JOIN users u ON u.id = tp.user_id
     ${leagueMemberJoinForTeamSession()}
     WHERE t.session_id = ?
     ORDER BY u.display_name ASC`,
    [sessionId],
  )

  const captains = await query(
    `SELECT t.id AS team_id, t.captain_user_id, u.username, u.display_name,
            ${LM_WORTH_SQL} AS player_worth
     FROM teams t
     LEFT JOIN users u ON u.id = t.captain_user_id
     LEFT JOIN sessions s_lm ON s_lm.id = t.session_id
     LEFT JOIN league_members lm ON lm.league_id = s_lm.league_id AND lm.user_id = t.captain_user_id AND lm.is_active = TRUE
     WHERE t.session_id = ? AND t.captain_user_id IS NOT NULL`,
    [sessionId],
  )

  const captainByTeam = Object.fromEntries(
    captains.map((c) => [String(c.team_id), c]),
  )

  return teams.map((team) => {
    const teamKey = String(team.id)
    const playersOnTeam = teamPlayers.filter((tp) => String(tp.team_id) === teamKey)
    const cap = captainByTeam[teamKey]
    const playerIds = new Set(playersOnTeam.map((p) => Number(p.user_id)))
    const roster = [...playersOnTeam]
    if (cap?.captain_user_id && !playerIds.has(Number(cap.captain_user_id))) {
      roster.unshift({
        team_id: team.id,
        user_id: cap.captain_user_id,
        username: cap.username,
        display_name: cap.display_name,
        player_worth: cap.player_worth,
        is_captain: true,
      })
    } else if (cap?.captain_user_id) {
      roster.forEach((p) => {
        if (Number(p.user_id) === Number(cap.captain_user_id)) {
          p.is_captain = true
        }
      })
    }
    return { ...team, players: roster }
  })
}

async function getGameHubPayload(sessionId, userId) {
  await ensureGameHubSchema()

  const sessions = await query(
    `SELECT s.id, s.league_id, s.title, s.session_date, s.session_time, s.location, s.format, s.status,
            COALESCE(s.bench_shuffle_done, 0) AS bench_shuffle_done
     FROM sessions s WHERE s.id = ? LIMIT 1`,
    [sessionId],
  )
  if (!sessions.length) {
    return { error: 'Session not found', status: 404 }
  }
  const session = sessions[0]

  const leagues = await query('SELECT id, name FROM leagues WHERE id = ? LIMIT 1', [session.league_id])
  const league = leagues[0] || null

  const teamsLocked = await allTeamsLocked(sessionId)
  if (!teamsLocked) {
    return {
      error: 'All teams must be locked before using Game Hub',
      status: 400,
    }
  }

  const teams = await getLockedTeamsPayload(sessionId)

  let mySubmission = null
  if (userId) {
    const subs = await query(
      `SELECT pss.*, u.username, u.display_name
       FROM player_stat_submissions pss
       INNER JOIN users u ON u.id = pss.user_id
       WHERE pss.session_id = ? AND pss.user_id = ?
       LIMIT 1`,
      [sessionId, userId],
    )
    if (subs.length) {
      mySubmission = await fetchSubmissionWithReviews(subs[0].id)
    }
  }

  const onTeam = userId ? await userIsSessionTeamPlayer(sessionId, userId) : false

  let reviewAssignments = []
  if (userId && onTeam) {
    reviewAssignments = await getReviewAssignments(sessionId, userId)
  }
  const hasSubmitted = Boolean(
    mySubmission && ['pending', 'approved'].includes(String(mySubmission.status)),
  )

  return {
    data: {
      session,
      league,
      teams,
      mySubmission,
      reviewAssignments,
      hasSubmitted,
      canSubmit: onTeam,
      allTeamsLocked: teamsLocked,
    },
  }
}

async function createOrResubmitStats(sessionId, userId, { goals, result, note }) {
  await ensureGameHubSchema()

  if (!(await allTeamsLocked(sessionId))) {
    return { error: 'All teams must be locked before submitting stats', status: 400 }
  }
  if (!(await userIsSessionTeamPlayer(sessionId, userId))) {
    return { error: 'Only players on a team in this session can submit stats', status: 403 }
  }

  const sessions = await query('SELECT id, league_id FROM sessions WHERE id = ? LIMIT 1', [sessionId])
  if (!sessions.length) {
    return { error: 'Session not found', status: 404 }
  }
  const leagueId = sessions[0].league_id

  const goalsNum = Math.max(0, Number.parseInt(String(goals), 10) || 0)
  if (result !== 'win' && result !== 'loss') {
    return { error: 'result must be win or loss', status: 400 }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [existingRows] = await conn.execute(
      'SELECT id, status FROM player_stat_submissions WHERE session_id = ? AND user_id = ? LIMIT 1',
      [sessionId, userId],
    )

    let submissionId
    if (existingRows.length) {
      const existing = existingRows[0]
      if (existing.status === 'approved') {
        await conn.rollback()
        return { error: 'Approved submissions cannot be edited', status: 400 }
      }
      if (existing.status === 'pending') {
        await conn.rollback()
        return { error: 'Your submission is pending review. Wait for reviewers before editing.', status: 400 }
      }

      submissionId = existing.id
      await conn.execute(
        `UPDATE player_stat_submissions
         SET goals = ?, result = ?, note = ?, status = 'pending', updated_at = NOW()
         WHERE id = ?`,
        [goalsNum, result, note || null, submissionId],
      )
      await resetReviewsConn(conn, submissionId, sessionId, userId)
    } else {
      const [ins] = await conn.execute(
        `INSERT INTO player_stat_submissions
         (session_id, league_id, user_id, goals, result, note, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [sessionId, leagueId, userId, goalsNum, result, note || null],
      )
      submissionId = ins.insertId
      await assignReviewersConn(conn, submissionId, sessionId, userId)
      await fulfillReviewSlotsForTargetConn(conn, sessionId, userId, submissionId)
    }

    await conn.commit()
    const submission = await fetchSubmissionWithReviews(submissionId)
    return { data: submission }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function submitReview(submissionId, reviewerUserId, { decision, declineNote }) {
  await ensureGameHubSchema()

  if (decision !== 'accepted' && decision !== 'declined') {
    return { error: 'decision must be accepted or declined', status: 400 }
  }
  if (decision === 'declined' && !String(declineNote || '').trim()) {
    return { error: 'decline_note is required when declining', status: 400 }
  }

  const subs = await query(
    'SELECT id, session_id, status FROM player_stat_submissions WHERE id = ? LIMIT 1',
    [submissionId],
  )
  if (!subs.length) {
    return { error: 'Submission not found', status: 404 }
  }
  if (subs[0].status !== 'pending') {
    return { error: 'This submission is no longer pending review', status: 400 }
  }

  const reviews = await query(
    `SELECT id, reviewer_user_id, decision
     FROM player_stat_reviews
     WHERE submission_id = ? AND reviewer_user_id = ?
     LIMIT 1`,
    [submissionId, reviewerUserId],
  )
  if (!reviews.length) {
    return { error: 'You are not assigned as a reviewer for this submission', status: 403 }
  }
  if (reviews[0].decision !== 'pending') {
    return { error: 'You have already reviewed this submission', status: 400 }
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE player_stat_reviews
       SET decision = ?, decline_note = ?, updated_at = NOW()
       WHERE id = ?`,
      [decision, decision === 'declined' ? String(declineNote || '').trim() : null, reviews[0].id],
    )
    const outcome = await processReviewsAfterDecisionConn(conn, submissionId)
    await conn.commit()

    const submission = await fetchSubmissionWithReviews(submissionId)
    return { data: { submission, outcome: outcome.status } }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

module.exports = {
  ensureGameHubSchema,
  getGameHubPayload,
  createOrResubmitStats,
  submitReview,
  isMissingTableError,
}
