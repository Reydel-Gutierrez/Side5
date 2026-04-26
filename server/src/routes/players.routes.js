const express = require('express')

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({
    data: [],
    message: 'Players placeholder endpoint',
  })
})

module.exports = router
