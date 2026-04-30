const express = require('express')
const { query } = require('../db/pool')

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    await query('SELECT 1')
    res.json({ status: 'ok', app: 'Side5 API', db: 'connected' })
  } catch (error) {
    res.status(500).json({
      error: 'Database health check failed',
      details: error.message,
    })
  }
})

module.exports = router
