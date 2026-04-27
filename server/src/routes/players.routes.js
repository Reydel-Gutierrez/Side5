const express = require('express')

const router = express.Router()

const players = [
  { id: 'p1', name: 'Reydel', initials: 'RD', value: 18.5, rating: 8.9, position: 'FW', status: 'confirmed' },
  { id: 'p2', name: 'Alexis', initials: 'AX', value: 14.2, rating: 8.2, position: 'MF', status: 'confirmed' },
  { id: 'p3', name: 'Migue', initials: 'MG', value: 9.8, rating: 7.6, position: 'DF', status: 'confirmed' },
  { id: 'p4', name: 'Jorge', initials: 'JG', value: 8.1, rating: 7.8, position: 'MF', status: 'confirmed' },
  { id: 'p5', name: 'Andres', initials: 'AN', value: 7.3, rating: 7.4, position: 'DF', status: 'pending' },
  { id: 'p6', name: 'Nico', initials: 'NC', value: 6.8, rating: 7.2, position: 'FW', status: 'pending' },
  { id: 'p7', name: 'Ivan', initials: 'IV', value: 6.0, rating: 7.0, position: 'GK', status: 'invited' },
  { id: 'p8', name: 'Pablo', initials: 'PB', value: 5.5, rating: 6.8, position: 'MF', status: 'invited' },
]

router.get('/', (_req, res) => {
  res.json({
    data: players,
    count: players.length,
  })
})

module.exports = router
