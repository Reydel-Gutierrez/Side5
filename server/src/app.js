const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const leaguesRoutes = require('./routes/leagues.routes')
const sessionsRoutes = require('./routes/sessions.routes')
const playersRoutes = require('./routes/players.routes')
const statsRoutes = require('./routes/stats.routes')

const app = express()

app.use(helmet())
app.use(cors())
app.use(morgan('dev'))
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true, limit: '8mb' }))

app.get('/', (_req, res) => {
  res.json({ app: 'Side5 API', status: 'running' })
})

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/leagues', leaguesRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/players', playersRoutes)
app.use('/api', statsRoutes)

module.exports = app
