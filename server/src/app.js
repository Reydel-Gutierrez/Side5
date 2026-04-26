const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const healthRoutes = require('./routes/health.routes')
const leaguesRoutes = require('./routes/leagues.routes')
const sessionsRoutes = require('./routes/sessions.routes')
const playersRoutes = require('./routes/players.routes')

const app = express()

app.use(helmet())
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ app: 'Side5 API', status: 'running' })
})

app.use('/api/health', healthRoutes)
app.use('/api/leagues', leaguesRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/players', playersRoutes)

module.exports = app
