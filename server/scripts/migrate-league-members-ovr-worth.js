require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { query, pool } = require('../src/db/pool')

const COLUMNS = [
  ['ovr', 'SMALLINT NOT NULL DEFAULT 60'],
  ['player_worth', 'DECIMAL(6,2) NOT NULL DEFAULT 10.00'],
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
    `UPDATE league_members lm
     INNER JOIN users u ON u.id = lm.user_id
     SET lm.player_worth = COALESCE(u.base_value, 10.00),
         lm.ovr = ROUND(COALESCE(lm.rating, u.rating, 6.0) * 10)
     WHERE lm.player_worth = 10.00 OR lm.ovr = 60`,
  )
  console.log('backfilled player_worth and ovr from users/league rating')

  await pool.end()
  console.log('Migration complete.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
