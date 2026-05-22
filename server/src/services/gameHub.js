const { query, pool } = require('../db/pool')
const {
  LM_RATING_SQL,
  LM_WORTH_SQL,
  LM_OVR_SQL,
  leagueMemberJoinForTeamSession,
} = require('../queries/leagueMemberStats')

let ensuredGameHubSchema = false

const RATING_OPTIONS = {
  Trash: 4,
  Bad: 5,
  Mid: 6.5,
  Good: 8,
  Beast: 10,
}

const RATING_LABELS = Object.keys(RATING_OPTIONS)

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE'
}

function isDuplicateColumnError(error) {
  return error?.code === 'ER_DUP_FIELDNAME'
}

async function addColumnIfMissing(table, column, definition) {
  try {
    await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error
  }
}

function roundRating(value) {
  return Math.round(Number(value) * 10) / 10
}

function isValidRatingChoice(label, value) {
  const expected = RATING_OPTIONS[label]
  return expected != null && Number(value) === expected
}

function averageAcceptedRatings(reviews) {
  const accepted = (reviews || []).filter(
    (r) => r.decision === 'accepted' && r.rating_value != null && !Number.isNaN(Number(r.rating_value)),
  )
  if (accepted.length < 2) return null
  const sum = accepted.reduce((s, r) => s + Number(r.rating_value), 0)
  return roundRating(sum / accepted.length)
}

function computeWeightedLeagueRating(oldRating, oldMatchesPlayed, matchRating) {
  const oldM = Number(oldMatchesPlayed) || 0
  const oldR = Number(oldRating) || 0
  const matchR = Number(matchRating)
  if (oldM <= 0) return roundRating(matchR)
  return roundRating((oldR * oldM + matchR) / (oldM + 1))
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
  await query(`
    CREATE TABLE IF NOT EXISTS session_mvp_votes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      league_id INT NOT NULL,
      voter_user_id INT NOT NULL,
      voted_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_session_voter (session_id, voter_user_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (league_id) REFERENCES leagues(id),
      FOREIGN KEY (voter_user_id) REFERENCES users(id),
      FOREIGN KEY (voted_user_id) REFERENCES users(id)
    )
  `)

  await addColumnIfMissing('player_stat_submissions', 'applied_to_league_members', 'BOOLEAN NOT NULL DEFAULT FALSE')
  await addColumnIfMissing('player_stat_submissions', 'approved_rating', 'DECIMAL(3,1) NULL')
  await addColumnIfMissing('player_stat_reviews', 'rating_label', 'VARCHAR(16) NULL')
  await addColumnIfMissing('player_stat_reviews', 'rating_value', 'DECIMAL(3,1) NULL')
  await addColumnIfMissing('sessions', 'stats_finalized', 'BOOLEAN NOT NULL DEFAULT FALSE')
  await addColumnIfMissing('sessions', 'stats_finalized_at', 'DATETIME NULL')
  await addColumnIfMissing('sessions', 'stats_finalized_by', 'INT NULL')

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

async function getSessionRow(sessionId) {
  const sessions = await query(
    `SELECT s.id, s.league_id, s.title, s.session_date, s.session_time, s.location, s.format, s.status,
            COALESCE(s.bench_shuffle_done, 0) AS bench_shuffle_done,
            COALESCE(s.stats_finalized, 0) AS stats_finalized,
            s.stats_finalized_at, s.stats_finalized_by
     FROM sessions s WHERE s.id = ? LIMIT 1`,
    [sessionId],
  )
  return sessions[0] || null
}

async function isSessionStatsFinalized(sessionId) {
  const session = await getSessionRow(sessionId)
  return Boolean(session && Number(session.stats_finalized) === 1)
}

async function userCanManageSession(sessionId, userId) {
  if (!userId) return false
  const rows = await query(
    `SELECT lm.role
     FROM sessions s
     INNER JOIN league_members lm ON lm.league_id = s.league_id AND lm.user_id = ? AND lm.is_active = TRUE
     WHERE s.id = ?
     LIMIT 1`,
    [userId, sessionId],
  )
  if (!rows.length) return false
  const role = String(rows[0].role || '').toLowerCase()
  return role === 'owner' || role === 'manager'
}

/** Active or inactive league members may view a session (e.g. past Game Hub). */
async function userCanViewSession(sessionId, userId) {
  if (!userId) return false
  const rows = await query(
    `SELECT lm.user_id
     FROM sessions s
     INNER JOIN league_members lm ON lm.league_id = s.league_id AND lm.user_id = ?
     WHERE s.id = ?
     LIMIT 1`,
    [userId, sessionId],
  )
  return rows.length > 0
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

async function getSessionPlayersList(sessionId) {
  const ids = await getSessionTeamPlayerIds(sessionId)
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(', ')
  const rows = await query(
    `SELECT id AS user_id, username, display_name FROM users WHERE id IN (${placeholders}) ORDER BY display_name ASC`,
    ids,
  )
  return rows
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
  await conn.execute(
    `UPDATE player_stat_submissions SET approved_rating = NULL, applied_to_league_members = FALSE WHERE id = ?`,
    [submissionId],
  )
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
            psr.id AS review_id, psr.decision AS review_decision,
            psr.rating_label, psr.rating_value, psr.decline_note
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

  const finalized = await isSessionStatsFinalized(sessionId)

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
      rating_label: row.rating_label,
      rating_value: row.rating_value != null ? Number(row.rating_value) : null,
      decline_note: row.decline_note,
      can_review:
        !finalized &&
        hasSubmitted &&
        submissionPending &&
        row.review_id != null &&
        reviewPending,
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
  const sub = subs[0]
  return {
    ...sub,
    applied_to_league_members: Boolean(Number(sub.applied_to_league_members)),
    approved_rating: sub.approved_rating != null ? Number(sub.approved_rating) : null,
    reviews: reviews.map((r) => ({
      ...r,
      rating_value: r.rating_value != null ? Number(r.rating_value) : null,
    })),
    decline_note: declineNotes[0] || null,
  }
}

async function applySubmissionToLeagueMemberConn(conn, leagueId, userId, goals, result, matchRating) {
  const [memberRows] = await conn.execute(
    `SELECT rating, matches_played FROM league_members
     WHERE league_id = ? AND user_id = ? AND is_active = TRUE
     LIMIT 1`,
    [leagueId, userId],
  )
  if (!memberRows.length) {
    throw new Error('League member not found for stat application')
  }
  const member = memberRows[0]
  const newRating = computeWeightedLeagueRating(
    member.rating,
    member.matches_played,
    matchRating,
  )
  const winInc = result === 'win' ? 1 : 0
  const lossInc = result === 'loss' ? 1 : 0
  await conn.execute(
    `UPDATE league_members
     SET matches_played = matches_played + 1,
         goals = goals + ?,
         wins = wins + ?,
         losses = losses + ?,
         rating = ?,
         updated_at = NOW()
     WHERE league_id = ? AND user_id = ? AND is_active = TRUE`,
    [goals, winInc, lossInc, newRating, leagueId, userId],
  )
}

async function processReviewsAfterDecisionConn(conn, submissionId) {
  const [subRows] = await conn.execute(
    `SELECT id, session_id, league_id, user_id, goals, result, status, applied_to_league_members
     FROM player_stat_submissions WHERE id = ? LIMIT 1`,
    [submissionId],
  )
  if (!subRows.length) return { status: 'not_found' }
  const sub = subRows[0]
  if (sub.status === 'approved' && Number(sub.applied_to_league_members) === 1) {
    return { status: 'already_approved' }
  }

  const [reviewRows] = await conn.execute(
    `SELECT id, decision, rating_value FROM player_stat_reviews WHERE submission_id = ?`,
    [submissionId],
  )
  const reviews = Array.isArray(reviewRows) ? reviewRows : []

  const anyDeclined = reviews.some((r) => r.decision === 'declined')
  if (anyDeclined) {
    await conn.execute(
      `UPDATE player_stat_submissions
       SET status = 'declined', approved_rating = NULL, updated_at = NOW()
       WHERE id = ?`,
      [submissionId],
    )
    return { status: 'declined' }
  }

  const allAccepted = reviews.length >= 2 && reviews.every((r) => r.decision === 'accepted')
  if (allAccepted) {
    const approvedRating = averageAcceptedRatings(reviews)
    await conn.execute(
      `UPDATE player_stat_submissions
       SET status = 'approved', approved_rating = ?, updated_at = NOW()
       WHERE id = ?`,
      [approvedRating, submissionId],
    )
    return { status: 'approved', approved_rating: approvedRating }
  }

  return { status: 'pending' }
}

async function getMvpVoteTotals(sessionId) {
  const rows = await query(
    `SELECT smv.voted_user_id, COUNT(*) AS vote_count,
            u.username, u.display_name
     FROM session_mvp_votes smv
     INNER JOIN users u ON u.id = smv.voted_user_id
     WHERE smv.session_id = ?
     GROUP BY smv.voted_user_id, u.username, u.display_name
     ORDER BY vote_count DESC, u.display_name ASC`,
    [sessionId],
  )
  return rows.map((r) => ({
    user_id: r.voted_user_id,
    vote_count: Number(r.vote_count) || 0,
    username: r.username,
    display_name: r.display_name,
  }))
}

function resolveMvpWinner(totals, overrideUserId) {
  if (!totals.length) return { winnerUserId: null, isTie: false }
  const maxVotes = totals[0].vote_count
  const leaders = totals.filter((t) => t.vote_count === maxVotes)
  if (leaders.length === 1) {
    return { winnerUserId: leaders[0].user_id, isTie: false }
  }
  if (overrideUserId && leaders.some((l) => Number(l.user_id) === Number(overrideUserId))) {
    return { winnerUserId: Number(overrideUserId), isTie: true }
  }
  return { winnerUserId: null, isTie: true, tiedUserIds: leaders.map((l) => l.user_id) }
}

async function getMvpVoteStatus(sessionId, userId) {
  const players = await getSessionPlayersList(sessionId)
  const totals = await getMvpVoteTotals(sessionId)
  let myVote = null
  if (userId) {
    const rows = await query(
      `SELECT voted_user_id FROM session_mvp_votes
       WHERE session_id = ? AND voter_user_id = ? LIMIT 1`,
      [sessionId, userId],
    )
    if (rows.length) {
      myVote = { voted_user_id: rows[0].voted_user_id }
    }
  }
  const { isTie } = resolveMvpWinner(totals, null)
  return {
    players,
    totals,
    myVote,
    hasVoted: Boolean(myVote),
    needs_manager_pick: isTie && totals.length > 0,
  }
}

async function getSessionVerificationSummary(sessionId) {
  const pendingReviewRows = await query(
    `SELECT COUNT(*) AS pending_reviews
     FROM player_stat_reviews psr
     INNER JOIN player_stat_submissions pss ON pss.id = psr.submission_id
     WHERE pss.session_id = ?
       AND pss.status = 'pending'
       AND psr.decision = 'pending'`,
    [sessionId],
  )

  const pendingReviewsCount = Number(pendingReviewRows[0]?.pending_reviews) || 0
  const finalized = await isSessionStatsFinalized(sessionId)
  const phase = finalized ? 'finalized' : pendingReviewsCount > 0 ? 'live' : 'concluded'

  return {
    phase,
    pendingReviewsCount,
  }
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

  if (!userId) {
    return { error: 'userId is required', status: 400 }
  }

  const session = await getSessionRow(sessionId)
  if (!session) {
    return { error: 'Session not found', status: 404 }
  }

  if (!(await userCanViewSession(sessionId, userId))) {
    return { error: 'You do not have access to this session', status: 403 }
  }

  const leagues = await query('SELECT id, name FROM leagues WHERE id = ? LIMIT 1', [session.league_id])
  const league = leagues[0] || null

  const statsFinalized = Number(session.stats_finalized) === 1
  const teamsLocked = await allTeamsLocked(sessionId)
  if (!teamsLocked && !statsFinalized) {
    return {
      error: 'All teams must be locked before using Game Hub',
      status: 400,
    }
  }

  const teams = await getLockedTeamsPayload(sessionId)
  const canManage = userId ? await userCanManageSession(sessionId, userId) : false

  let mySubmission = null
  if (userId) {
    const subs = await query(
      `SELECT pss.id FROM player_stat_submissions pss
       WHERE pss.session_id = ? AND pss.user_id = ? LIMIT 1`,
      [sessionId, userId],
    )
    if (subs.length) {
      mySubmission = await fetchSubmissionWithReviews(subs[0].id)
    }
  }

  const onTeam = userId ? await userIsSessionTeamPlayer(sessionId, userId) : false

  let reviewAssignments = []
  if (userId && onTeam && !statsFinalized) {
    reviewAssignments = await getReviewAssignments(sessionId, userId)
  } else if (userId && onTeam && statsFinalized) {
    reviewAssignments = await getReviewAssignments(sessionId, userId)
  }

  const hasSubmitted = Boolean(
    mySubmission && ['pending', 'approved'].includes(String(mySubmission.status)),
  )

  const verification = await getSessionVerificationSummary(sessionId)
  const mvpVote = await getMvpVoteStatus(sessionId, userId)
  const mvpTotals = await getMvpVoteTotals(sessionId)
  const { winnerUserId: mvpWinnerUserId } = resolveMvpWinner(mvpTotals, null)
  let mvpWinner = null
  if (mvpWinnerUserId) {
    const winnerRows = await query(
      'SELECT id, username, display_name FROM users WHERE id = ? LIMIT 1',
      [mvpWinnerUserId],
    )
    if (winnerRows.length) {
      mvpWinner = {
        user_id: mvpWinnerUserId,
        username: winnerRows[0].username,
        display_name: winnerRows[0].display_name,
      }
    }
  }

  return {
    data: {
      session: {
        ...session,
        stats_finalized: statsFinalized,
      },
      league,
      teams,
      mySubmission,
      reviewAssignments,
      hasSubmitted,
      canSubmit: onTeam && !statsFinalized,
      can_manage: canManage,
      allTeamsLocked: teamsLocked || statsFinalized,
      stats_finalized: statsFinalized,
      verification,
      mvpVote,
      mvp_winner: mvpWinner,
      mvp_winner_user_id: mvpWinnerUserId,
      ratingOptions: RATING_LABELS.map((label) => ({
        label,
        value: RATING_OPTIONS[label],
      })),
    },
  }
}

async function createOrResubmitStats(sessionId, userId, { goals, result, note }) {
  await ensureGameHubSchema()

  if (await isSessionStatsFinalized(sessionId)) {
    return { error: 'Session stats are finalized and cannot be changed', status: 400 }
  }

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
      'SELECT id, status, applied_to_league_members FROM player_stat_submissions WHERE session_id = ? AND user_id = ? LIMIT 1',
      [sessionId, userId],
    )

    let submissionId
    if (existingRows.length) {
      const existing = existingRows[0]
      if (existing.status === 'approved') {
        await conn.rollback()
        return { error: 'Approved submissions cannot be edited until manager finalizes the session', status: 400 }
      }
      if (Number(existing.applied_to_league_members) === 1) {
        await conn.rollback()
        return { error: 'Stats for this session have already been applied', status: 400 }
      }
      if (existing.status === 'pending') {
        await conn.rollback()
        return { error: 'Your submission is pending review. Wait for reviewers before editing.', status: 400 }
      }

      submissionId = existing.id
      await conn.execute(
        `UPDATE player_stat_submissions
         SET goals = ?, result = ?, note = ?, status = 'pending', approved_rating = NULL,
             applied_to_league_members = FALSE, updated_at = NOW()
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

async function submitReview(submissionId, reviewerUserId, { decision, declineNote, ratingLabel, ratingValue }) {
  await ensureGameHubSchema()

  if (decision !== 'accepted' && decision !== 'declined') {
    return { error: 'decision must be accepted or declined', status: 400 }
  }
  if (decision === 'declined' && !String(declineNote || '').trim()) {
    return { error: 'decline_note is required when declining', status: 400 }
  }
  if (decision === 'accepted') {
    if (!isValidRatingChoice(ratingLabel, ratingValue)) {
      return {
        error: 'rating_label and rating_value are required when accepting (Trash/Bad/Mid/Good/Beast)',
        status: 400,
      }
    }
  }

  const subs = await query(
    'SELECT id, session_id, user_id, status FROM player_stat_submissions WHERE id = ? LIMIT 1',
    [submissionId],
  )
  if (!subs.length) {
    return { error: 'Submission not found', status: 404 }
  }
  if (Number(subs[0].user_id) === Number(reviewerUserId)) {
    return { error: 'You cannot review your own submission', status: 403 }
  }
  if (await isSessionStatsFinalized(subs[0].session_id)) {
    return { error: 'Session stats are finalized', status: 400 }
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
       SET decision = ?, decline_note = ?, rating_label = ?, rating_value = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        decision,
        decision === 'declined' ? String(declineNote || '').trim() : null,
        decision === 'accepted' ? ratingLabel : null,
        decision === 'accepted' ? ratingValue : null,
        reviews[0].id,
      ],
    )
    const outcome = await processReviewsAfterDecisionConn(conn, submissionId)
    await conn.commit()

    const submission = await fetchSubmissionWithReviews(submissionId)
    return { data: { submission, outcome: outcome.status, approved_rating: outcome.approved_rating } }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function submitMvpVote(sessionId, voterUserId, votedUserId) {
  await ensureGameHubSchema()

  if (await isSessionStatsFinalized(sessionId)) {
    return { error: 'Session stats are finalized', status: 400 }
  }
  if (!(await allTeamsLocked(sessionId))) {
    return { error: 'All teams must be locked before voting', status: 400 }
  }
  if (!(await userIsSessionTeamPlayer(sessionId, voterUserId))) {
    return { error: 'Only session players can vote for MVP', status: 403 }
  }
  const playerIds = await getSessionTeamPlayerIds(sessionId)
  if (!playerIds.includes(Number(votedUserId))) {
    return { error: 'You can only vote for a player in this session', status: 400 }
  }
  if (Number(votedUserId) === Number(voterUserId)) {
    return { error: 'You cannot vote for yourself', status: 400 }
  }

  const session = await getSessionRow(sessionId)
  if (!session) {
    return { error: 'Session not found', status: 404 }
  }

  const existing = await query(
    'SELECT id FROM session_mvp_votes WHERE session_id = ? AND voter_user_id = ? LIMIT 1',
    [sessionId, voterUserId],
  )
  if (existing.length) {
    return { error: 'You have already voted for MVP in this session', status: 400 }
  }

  await query(
    `INSERT INTO session_mvp_votes (session_id, league_id, voter_user_id, voted_user_id)
     VALUES (?, ?, ?, ?)`,
    [sessionId, session.league_id, voterUserId, votedUserId],
  )

  const mvpVote = await getMvpVoteStatus(sessionId, voterUserId)
  return { data: mvpVote }
}

async function buildReviewAllPlayers(sessionId) {
  const players = await getSessionPlayersList(sessionId)
  const mvpTotals = await getMvpVoteTotals(sessionId)
  const mvpByUser = Object.fromEntries(mvpTotals.map((t) => [String(t.user_id), t.vote_count]))

  const submissions = await query(
    `SELECT pss.*, u.username, u.display_name
     FROM player_stat_submissions pss
     INNER JOIN users u ON u.id = pss.user_id
     WHERE pss.session_id = ?
     ORDER BY u.display_name ASC`,
    [sessionId],
  )

  const submissionByUser = Object.fromEntries(
    submissions.map((s) => [String(s.user_id), s]),
  )

  const reviewRows = await query(
    `SELECT psr.*, u.username AS reviewer_username, u.display_name AS reviewer_display_name
     FROM player_stat_reviews psr
     INNER JOIN player_stat_submissions pss ON pss.id = psr.submission_id
     INNER JOIN users u ON u.id = psr.reviewer_user_id
     WHERE pss.session_id = ?
     ORDER BY psr.submission_id ASC, psr.id ASC`,
    [sessionId],
  )
  const reviewsBySubmission = {}
  for (const r of reviewRows) {
    const key = String(r.submission_id)
    if (!reviewsBySubmission[key]) reviewsBySubmission[key] = []
    reviewsBySubmission[key].push({
      ...r,
      rating_value: r.rating_value != null ? Number(r.rating_value) : null,
    })
  }

  return players.map((player) => {
    const sub = submissionByUser[String(player.user_id)]
    const reviews = sub ? reviewsBySubmission[String(sub.id)] || [] : []
    const calculatedRating = sub?.approved_rating != null
      ? Number(sub.approved_rating)
      : averageAcceptedRatings(reviews)
    const pendingReviews = reviews.filter((r) => r.decision === 'pending').length
    return {
      user_id: player.user_id,
      username: player.username,
      display_name: player.display_name,
      submission: sub
        ? {
            id: sub.id,
            goals: sub.goals,
            result: sub.result,
            note: sub.note,
            status: sub.status,
            approved_rating: sub.approved_rating != null ? Number(sub.approved_rating) : calculatedRating,
            applied_to_league_members: Boolean(Number(sub.applied_to_league_members)),
          }
        : null,
      reviews,
      calculated_rating: calculatedRating,
      mvp_votes: mvpByUser[String(player.user_id)] || 0,
      pending_reviews: pendingReviews,
      awaiting_player: !sub,
      awaiting_reviewers: Boolean(sub && sub.status === 'pending' && pendingReviews > 0),
    }
  })
}

function normalizeFinalizePlayerEntry(entry) {
  const include = entry?.include !== false
  const userId = entry?.user_id != null ? Number(entry.user_id) : null
  const submissionId = entry?.submission_id != null ? Number(entry.submission_id) : null
  const goals = Math.max(0, Number.parseInt(String(entry?.goals ?? ''), 10) || 0)
  const result = entry?.result === 'loss' ? 'loss' : 'win'
  const approvedRatingRaw = entry?.approved_rating
  const approvedRating =
    approvedRatingRaw != null && approvedRatingRaw !== ''
      ? roundRating(approvedRatingRaw)
      : null
  return { include, userId, submissionId, goals, result, approvedRating }
}

async function upsertManagerApprovedSubmissionConn(
  conn,
  sessionId,
  leagueId,
  targetUserId,
  { goals, result, approvedRating },
) {
  const matchRating = roundRating(approvedRating)
  if (matchRating == null || Number.isNaN(matchRating)) {
    throw new Error('approved_rating is required')
  }

  const [rows] = await conn.execute(
    `SELECT id, applied_to_league_members FROM player_stat_submissions
     WHERE session_id = ? AND user_id = ? LIMIT 1`,
    [sessionId, targetUserId],
  )
  if (rows.length) {
    if (Number(rows[0].applied_to_league_members) === 1) {
      return { submissionId: rows[0].id, alreadyApplied: true }
    }
    await conn.execute(
      `UPDATE player_stat_submissions
       SET goals = ?, result = ?, status = 'approved', approved_rating = ?,
           applied_to_league_members = FALSE, updated_at = NOW()
       WHERE id = ?`,
      [goals, result, matchRating, rows[0].id],
    )
    return { submissionId: rows[0].id, alreadyApplied: false }
  }

  const [ins] = await conn.execute(
    `INSERT INTO player_stat_submissions
     (session_id, league_id, user_id, goals, result, status, approved_rating)
     VALUES (?, ?, ?, ?, ?, 'approved', ?)`,
    [sessionId, leagueId, targetUserId, goals, result, matchRating],
  )
  return { submissionId: ins.insertId, alreadyApplied: false }
}

async function resolveTargetUserId(sessionId, { userId, submissionId }) {
  if (userId && !Number.isNaN(userId)) {
    if (!(await userIsSessionTeamPlayer(sessionId, userId))) {
      return { error: 'Player is not on a team in this session', status: 400 }
    }
    return { userId }
  }
  if (submissionId && !Number.isNaN(submissionId)) {
    const rows = await query(
      'SELECT user_id FROM player_stat_submissions WHERE id = ? AND session_id = ? LIMIT 1',
      [submissionId, sessionId],
    )
    if (!rows.length) {
      return { error: 'Submission not found', status: 404 }
    }
    return { userId: Number(rows[0].user_id) }
  }
  return { error: 'user_id or submission_id is required', status: 400 }
}

async function saveReviewAllDraft(sessionId, managerUserId, { players }) {
  await ensureGameHubSchema()

  if (!(await userCanManageSession(sessionId, managerUserId))) {
    return { error: 'Only league owners and managers can save review data', status: 403 }
  }
  if (await isSessionStatsFinalized(sessionId)) {
    return { error: 'Session stats are finalized', status: 400 }
  }

  const session = await getSessionRow(sessionId)
  if (!session) {
    return { error: 'Session not found', status: 404 }
  }

  const entries = Array.isArray(players) ? players : []
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    let saved = 0
    for (const raw of entries) {
      const entry = normalizeFinalizePlayerEntry(raw)
      if (entry.approvedRating == null || Number.isNaN(entry.approvedRating)) continue

      const resolved = await resolveTargetUserId(sessionId, entry)
      if (resolved.error) {
        await conn.rollback()
        return { error: resolved.error, status: resolved.status }
      }

      await upsertManagerApprovedSubmissionConn(conn, sessionId, session.league_id, resolved.userId, {
        goals: entry.goals,
        result: entry.result,
        approvedRating: entry.approvedRating,
      })
      saved += 1
    }
    await conn.commit()
    const reviewAll = await getReviewAllPayload(sessionId, managerUserId)
    return { data: reviewAll.data, saved }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

async function getReviewAllPayload(sessionId, managerUserId) {
  await ensureGameHubSchema()

  if (!(await userCanManageSession(sessionId, managerUserId))) {
    return { error: 'Only league owners and managers can review all stats', status: 403 }
  }

  const session = await getSessionRow(sessionId)
  if (!session) {
    return { error: 'Session not found', status: 404 }
  }

  const players = await buildReviewAllPlayers(sessionId)
  const mvpTotals = await getMvpVoteTotals(sessionId)
  const { winnerUserId, isTie, tiedUserIds } = resolveMvpWinner(mvpTotals, null)

  return {
    data: {
      session: {
        ...session,
        stats_finalized: Number(session.stats_finalized) === 1,
      },
      players,
      mvp_totals: mvpTotals,
      mvp_winner_user_id: winnerUserId,
      mvp_needs_pick: isTie,
      mvp_tied_user_ids: tiedUserIds || [],
      ratingOptions: RATING_LABELS.map((label) => ({
        label,
        value: RATING_OPTIONS[label],
      })),
    },
  }
}

async function finalizeSessionStats(sessionId, managerUserId, { submissions, players, mvpWinnerUserId }) {
  await ensureGameHubSchema()

  if (!(await userCanManageSession(sessionId, managerUserId))) {
    return { error: 'Only league owners and managers can finalize stats', status: 403 }
  }

  const session = await getSessionRow(sessionId)
  if (!session) {
    return { error: 'Session not found', status: 404 }
  }
  if (Number(session.stats_finalized) === 1) {
    return {
      error: 'Session stats have already been finalized. This game is in Past Sessions.',
      status: 400,
    }
  }

  const legacyEntries = Array.isArray(submissions)
    ? submissions.map((s) => ({ ...s, include: s.include !== false }))
    : []
  const playerEntries = Array.isArray(players) ? players : legacyEntries
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    let appliedCount = 0
    let skippedCount = 0

    for (const raw of playerEntries) {
      const entry = normalizeFinalizePlayerEntry(raw)
      if (!entry.include) {
        skippedCount += 1
        continue
      }

      if (entry.approvedRating == null || Number.isNaN(entry.approvedRating)) {
        await conn.rollback()
        return {
          error: 'Each included player needs goals, result, and a match rating',
          status: 400,
        }
      }

      const resolved = await resolveTargetUserId(sessionId, entry)
      if (resolved.error) {
        await conn.rollback()
        return { error: resolved.error, status: resolved.status }
      }

      const upserted = await upsertManagerApprovedSubmissionConn(
        conn,
        sessionId,
        session.league_id,
        resolved.userId,
        {
          goals: entry.goals,
          result: entry.result,
          approvedRating: entry.approvedRating,
        },
      )
      if (upserted.alreadyApplied) {
        skippedCount += 1
        continue
      }

      const [subRows] = await conn.execute(
        `SELECT id, league_id, user_id, goals, result, approved_rating, applied_to_league_members
         FROM player_stat_submissions WHERE id = ? LIMIT 1`,
        [upserted.submissionId],
      )
      const sub = subRows[0]
      const matchRating = roundRating(sub.approved_rating)

      await applySubmissionToLeagueMemberConn(
        conn,
        sub.league_id,
        sub.user_id,
        Number(sub.goals) || 0,
        sub.result,
        matchRating,
      )

      await conn.execute(
        `UPDATE player_stat_submissions
         SET applied_to_league_members = TRUE, updated_at = NOW()
         WHERE id = ?`,
        [sub.id],
      )
      appliedCount += 1
    }

    const mvpTotals = await getMvpVoteTotals(sessionId)
    const { winnerUserId, isTie } = resolveMvpWinner(mvpTotals, mvpWinnerUserId)
    if (mvpTotals.length > 0) {
      if (isTie && !mvpWinnerUserId) {
        await conn.rollback()
        return { error: 'MVP vote is tied — pick a winner before finalizing', status: 400 }
      }
      if (winnerUserId) {
        await conn.execute(
          `UPDATE league_members
           SET mvp_count = mvp_count + 1, updated_at = NOW()
           WHERE league_id = ? AND user_id = ? AND is_active = TRUE`,
          [session.league_id, winnerUserId],
        )
      }
    }

    await conn.execute(
      `UPDATE sessions
       SET stats_finalized = TRUE,
           stats_finalized_at = NOW(),
           stats_finalized_by = ?,
           status = 'past'
       WHERE id = ?`,
      [managerUserId, sessionId],
    )

    await conn.commit()
    const reviewAll = await getReviewAllPayload(sessionId, managerUserId)
    return {
      data: reviewAll.data,
      message: 'Session finalized. This game has been moved to Past Sessions.',
      applied_count: appliedCount,
      skipped_count: skippedCount,
    }
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
  submitMvpVote,
  getReviewAllPayload,
  saveReviewAllDraft,
  finalizeSessionStats,
  userCanViewSession,
  isSessionStatsFinalized,
  isMissingTableError,
  RATING_OPTIONS,
  RATING_LABELS,
}
