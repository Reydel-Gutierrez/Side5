require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const http = require('http')
const app = require('../src/app')

const paths = [
  '/api/health',
  '/api/players/leaderboard',
  '/api/leagues/1/leaderboard',
  '/api/leagues/mine?userId=1',
  '/api/leagues/1/members',
  '/api/leagues/99999/leaderboard',
]

function request(path) {
  return new Promise((resolve) => {
    http
      .get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          let parsed = null
          try {
            parsed = JSON.parse(body)
          } catch {
            parsed = body.slice(0, 120)
          }
          resolve({ path, status: res.statusCode, body: parsed })
        })
      })
      .on('error', (err) => resolve({ path, status: 'ERR', body: err.message }))
  })
}

const port = 5099
const server = http.createServer(app)

server.listen(port, async () => {
  console.log(`Testing on http://127.0.0.1:${port}\n`)
  for (const path of paths) {
    const result = await request(path)
    const summary =
      typeof result.body === 'object'
        ? result.body.error || `ok players=${result.body?.data?.players?.length ?? result.body?.count ?? 'n/a'}`
        : result.body
    console.log(`${result.status} ${result.path} -> ${summary}`)
  }
  server.close()
})
