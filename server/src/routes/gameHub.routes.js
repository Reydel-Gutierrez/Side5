const express = require('express')
const { getGameHubPayload, createOrResubmitStats } = require('../services/gameHub')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

router.get('/:id/game-hub', async (req, res) => {
  const sessionId = Number.parseInt(req.params.id, 10)
  const userId = Number.parseInt(String(req.query.userId ?? ''), 10)

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }

  try {
    const result = await getGameHubPayload(sessionId, Number.isNaN(userId) ? null : userId)
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
  const userId = Number.parseInt(String(req.body?.userId ?? ''), 10)
  const { goals, result, note } = req.body

  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'userId is required' })
  }

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

module.exports = router
