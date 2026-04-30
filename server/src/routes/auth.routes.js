const express = require('express')
const { query } = require('../db/pool')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' })
  }

  try {
    const users = await query('SELECT * FROM users WHERE username = ? LIMIT 1', [username])
    const user = users[0]

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const { password_hash, ...safeUser } = user
    return res.json({ user: safeUser })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.post('/register', async (req, res) => {
  const displayNameRaw = req.body.displayName ?? req.body.display_name ?? req.body.fullName
  const { username, password } = req.body

  if (!username || !password || displayNameRaw == null || String(displayNameRaw).trim() === '') {
    return res.status(400).json({ error: 'username, password, and displayName are required' })
  }

  const normalizedUsername = String(username).trim().toLowerCase()
  const displayName = String(displayNameRaw).trim()
  const passwordHash = String(password).trim()

  if (!normalizedUsername || !passwordHash) {
    return res.status(400).json({ error: 'username and password must not be empty' })
  }

  try {
    const insertResult = await query(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES (?, ?, ?)`,
      [normalizedUsername, passwordHash, displayName],
    )
    const userId = insertResult.insertId

    try {
      await query(`INSERT INTO player_profiles (user_id) VALUES (?)`, [userId])
    } catch (profileError) {
      return handleSqlError(res, profileError)
    }

    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId])
    const created = rows[0]
    if (!created) {
      return res.status(500).json({ error: 'User was created but could not be loaded' })
    }
    const { password_hash, ...safeUser } = created
    return res.status(201).json({ user: safeUser })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already taken' })
    }
    return handleSqlError(res, error)
  }
})

module.exports = router
