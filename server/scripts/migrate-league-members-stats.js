require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { query, pool } = require('../src/db/pool')

const COLUMNS = [
  ['is_active', 'BOOLEAN NOT NULL DEFAULT TRUE'],
  ['matches_played', 'INT NOT NULL DEFAULT 0'],
  ['rating', 'DECIMAL(3,1) NOT NULL DEFAULT 6.0'],
  ['goals', 'INT NOT NULL DEFAULT 0'],
  ['wins', 'INT NOT NULL DEFAULT 0'],
  ['losses', 'INT NOT NULL DEFAULT 0'],
  ['mvp_count', 'INT NOT NULL DEFAULT 0'],
  ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
]

async function columnExists(name) {
  const rows = await query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'league_members'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [name],
  )
  return rows.length > 0
}

async function main() {
  for (const [name, definition] of COLUMNS) {
    if (await columnExists(name)) {
      console.log('skip:', name)
      continue
    }
    await query(`ALTER TABLE league_members ADD COLUMN ${name} ${definition}`)
    console.log('added:', name)
  }

  await query(
    `UPDATE league_members
     SET rating = 6.0, matches_played = 0
     WHERE matches_played = 0`,
  )
  console.log('normalized zero-match ratings')

  await pool.end()
  console.log('Migration complete.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
