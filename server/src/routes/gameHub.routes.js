const express = require('express')
const {
  getGameHubPayload,
  createOrResubmitStats,
  submitMvpVote,
  getReviewAllPayload,
  saveReviewAllDraft,
  finalizeSessionStats,
} = require('../services/gameHub')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

function parseUserId(value) {
  const id = Number.parseInt(String(value ?? ''), 10)
  return Number.isNaN(id) ? null : id
}

router.get('/:id/game-hub', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const userId = parseUserId(req.query.userId)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  try {
    const result = await getGameHubPayload(sessionId, userId)
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error })
    }
    return res.json({ data: result.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/stat-submissions', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const userId = parseUserId(req.body?.userId)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  const { goals, result, note } = req.body

  try {
    const outcome = await createOrResubmitStats(sessionId, userId, { goals, result, note })
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.status(201).json({ message: 'Stats submitted', data: outcome.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/mvp-vote', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const voterUserId = parseUserId(req.body?.userId ?? req.body?.voter_user_id)
  const votedUserId = parseUserId(req.body?.voted_user_id)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!voterUserId) {
    return res.status(400).json({ error: 'userId is required' })
  }
  if (!votedUserId) {
    return res.status(400).json({ error: 'voted_user_id is required' })
  }

  try {
    const outcome = await submitMvpVote(sessionId, voterUserId, votedUserId)
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.status(201).json({ message: 'MVP vote recorded', data: outcome.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/review-all', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const managerUserId = parseUserId(req.query.userId)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!managerUserId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const outcome = await getReviewAllPayload(sessionId, managerUserId)
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.json({ data: outcome.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/review-all/save', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const managerUserId = parseUserId(req.body?.userId ?? req.body?.manager_user_id)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!managerUserId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  const { players } = req.body

  try {
    const outcome = await saveReviewAllDraft(sessionId, managerUserId, { players })
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.json({ message: 'Review data saved', saved: outcome.saved, data: outcome.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/:id/finalize-stats', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const managerUserId = parseUserId(req.body?.userId ?? req.body?.manager_user_id)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (!managerUserId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  const {
    submissions,
    players,
    mvp_winner_user_id: mvpWinnerSnake,
    mvpWinnerUserId: mvpWinnerCamel,
  } = req.body
  const mvpWinnerUserId = parseUserId(mvpWinnerSnake ?? mvpWinnerCamel)

  try {
    const outcome = await finalizeSessionStats(sessionId, managerUserId, {
      submissions,
      players,
      mvpWinnerUserId: mvpWinnerUserId ?? undefined,
    })
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.json({
      message: outcome.message,
      applied_count: outcome.applied_count,
      skipped_count: outcome.skipped_count,
      data: outcome.data,
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
