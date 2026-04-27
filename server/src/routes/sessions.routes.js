const express = require('express')

const router = express.Router()

const sessions = [
  {
    id: 's1',
    title: 'Monday Night',
    date: '2026-05-04',
    time: '8:00 PM',
    location: 'North Indoor Arena',
    format: '5v5',
    budgetPerTeam: 50,
    status: 'upcoming',
  },
  {
    id: 's2',
    title: 'Thursday Mix',
    date: '2026-05-08',
    time: '9:00 PM',
    location: 'City Five Grounds',
    format: '5v5',
    budgetPerTeam: 50,
    status: 'upcoming',
  },
  {
    id: 's3',
    title: 'Weekend Cup',
    date: '2026-04-19',
    time: '6:30 PM',
    location: 'South Turf Dome',
    format: '5v5',
    budgetPerTeam: 50,
    status: 'completed',
  },
]

router.get('/', (_req, res) => {
  res.json({
    data: sessions,
    count: sessions.length,
  })
})

module.exports = router
