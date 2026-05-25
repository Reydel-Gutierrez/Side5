/**
 * Adds player_style_votes table and league_members style_* columns (idempotent).
 * Usage: node scripts/migrate-player-style-reviews.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const MIGRATION_PATH = path.join(__dirname, '..', 'src', 'db', 'migrate_player_style_reviews.sql')

function isBenignAlterError(error) {
  const code = error?.code
  return code === 'ER_DUP_FIELDNAME' || code === 'ER_TABLE_EXISTS_ERROR'
}

async function run() {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')
  const statements = sql
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'side5',
    multipleStatements: false,
  })

  try {
    for (const statement of statements) {
      try {
        await conn.execute(statement)
        console.log('OK:', statement.slice(0, 72).replace(/\s+/g, ' '), '...')
      } catch (error) {
        if (isBenignAlterError(error)) {
          console.log('SKIP (already applied):', statement.slice(0, 48).replace(/\s+/g, ' '))
          continue
        }
        throw error
      }
    }
    console.log('Migration complete.')
  } finally {
    await conn.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
