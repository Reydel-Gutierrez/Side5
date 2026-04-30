const express = require('express')
const { query } = require('../db/pool')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

router.post('/matches/:matchId/stats', async (req, res) => {
  const matchId = Number.parseInt(req.params.matchId, 10)
  const { userId, goals, assists, saves, isMvp, notes } = req.body

  if (Number.isNaN(matchId)) {
    return res.status(400).json({ error: 'Invalid match id' })
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const matches = await query('SELECT id, session_id FROM matches WHERE id = ? LIMIT 1', [matchId])
    if (!matches.length) {
      return res.status(404).json({ error: 'Match not found' })
    }

    const match = matches[0]
    const sessions = await query('SELECT id, league_id FROM sessions WHERE id = ? LIMIT 1', [match.session_id])
    if (!sessions.length) {
      return res.status(404).json({ error: 'Session not found for match' })
    }

    const session = sessions[0]
    const users = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' })
    }

    const result = await query(
      `INSERT INTO stat_submissions
      (match_id, session_id, league_id, user_id, goals, assists, saves, is_mvp, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        matchId,
        match.session_id,
        session.league_id,
        userId,
        goals || 0,
        assists || 0,
        saves || 0,
        Boolean(isMvp),
        notes || null,
      ]
    )

    return res.status(201).json({
      message: 'Stat submission created',
      data: { id: result.insertId, match_id: matchId, user_id: userId, status: 'pending' },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/matches/:matchId/stats/pending', async (req, res) => {
  const matchId = Number.parseInt(req.params.matchId, 10)
  if (Number.isNaN(matchId)) {
    return res.status(400).json({ error: 'Invalid match id' })
  }

  try {
    const submissions = await query(
      `SELECT ss.*, u.username, u.display_name
       FROM stat_submissions ss
       INNER JOIN users u ON ss.user_id = u.id
       WHERE ss.match_id = ? AND ss.status = 'pending'
       ORDER BY ss.created_at ASC`,
      [matchId]
    )

    return res.json({ data: submissions, count: submissions.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/stats/:submissionId/approve', async (req, res) => {
  const submissionId = Number.parseInt(req.params.submissionId, 10)
  const { reviewedByUserId } = req.body

  if (Number.isNaN(submissionId)) {
    return res.status(400).json({ error: 'Invalid submission id' })
  }
  if (!reviewedByUserId) {
    return res.status(400).json({ error: 'reviewedByUserId is required' })
  }

  try {
    const result = await query(
      `UPDATE stat_submissions
       SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [reviewedByUserId, submissionId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    return res.json({ message: 'Submission approved', data: { submissionId, status: 'approved' } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/stats/:submissionId/deny', async (req, res) => {
  const submissionId = Number.parseInt(req.params.submissionId, 10)
  const { reviewedByUserId } = req.body

  if (Number.isNaN(submissionId)) {
    return res.status(400).json({ error: 'Invalid submission id' })
  }
  if (!reviewedByUserId) {
    return res.status(400).json({ error: 'reviewedByUserId is required' })
  }

  try {
    const result = await query(
      `UPDATE stat_submissions
       SET status = 'denied', reviewed_by_user_id = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [reviewedByUserId, submissionId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    return res.json({ message: 'Submission denied', data: { submissionId, status: 'denied' } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
