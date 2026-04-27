const express = require('express')

const router = express.Router()

const leagues = [
  {
    id: 'l1',
    name: 'Side5 Premier Night',
    city: 'Santo Domingo',
    season: 'Spring 2026',
    totalSessions: 12,
    activeSessions: 2,
  },
]

router.get('/', (_req, res) => {
  res.json({
    data: leagues,
    count: leagues.length,
  })
})

module.exports = router
