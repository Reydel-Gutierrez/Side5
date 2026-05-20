require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const { query, pool } = require('../src/db/pool')

async function main() {
  const sqlPath = path.join(__dirname, '..', 'src', 'db', 'migrate_player_stat_submissions.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await query(statement)
    console.log('ok:', statement.slice(0, 48).replace(/\s+/g, ' '), '…')
  }

  await pool.end()
  console.log('Migration complete.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
