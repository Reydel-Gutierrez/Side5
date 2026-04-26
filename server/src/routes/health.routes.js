const express = require('express')

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ status: 'ok', app: 'Side5 API' })
})

module.exports = router
