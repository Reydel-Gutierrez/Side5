const express = require('express')
const { submitReview } = require('../services/gameHub')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

router.post('/:submissionId/reviews', async (req, res) => {
  const submissionId = Number.parseInt(req.params.submissionId, 10)
  const reviewerUserId = Number.parseInt(String(req.body?.reviewerUserId ?? req.body?.userId ?? ''), 10)
  const { decision, decline_note: declineNote, declineNote: declineNoteCamel } = req.body

  if (Number.isNaN(submissionId)) {
    return res.status(400).json({ error: 'Invalid submission id' })
  }
  if (Number.isNaN(reviewerUserId)) {
    return res.status(400).json({ error: 'reviewerUserId is required' })
  }

  try {
    const outcome = await submitReview(submissionId, reviewerUserId, {
      decision,
      declineNote: declineNote ?? declineNoteCamel,
    })
    if (outcome.error) {
      return res.status(outcome.status || 400).json({ error: outcome.error })
    }
    return res.json({ message: 'Review recorded', data: outcome.data })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
