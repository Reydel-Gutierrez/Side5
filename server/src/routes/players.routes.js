const express = require('express')
const { query } = require('../db/pool')

const router = express.Router()

function handleSqlError(res, error) {
  return res.status(500).json({ error: 'Database error', details: error.message })
}

function isMissingAvatarColumn(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' && String(error?.message || '').includes('avatar_image')
}

async function ensureAvatarColumn() {
  await query('ALTER TABLE users ADD COLUMN avatar_image MEDIUMTEXT NULL')
}

async function queryUsersWithOptionalAvatar(sqlWithAvatar, sqlWithoutAvatar, params = []) {
  try {
    return await query(sqlWithAvatar, params)
  } catch (error) {
    if (!isMissingAvatarColumn(error)) throw error
    return query(sqlWithoutAvatar, params)
  }
}

router.get('/', async (_req, res) => {
  try {
    const players = await queryUsersWithOptionalAvatar(
      `SELECT id, username, display_name, base_value, rating, avatar_image, created_at
       FROM users
       ORDER BY display_name ASC`,
      `SELECT id, username, display_name, base_value, rating, '' AS avatar_image, created_at
       FROM users
       ORDER BY display_name ASC`
    )
    return res.json({ data: players, count: players.length })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id/summary', async (req, res) => {
  const playerId = Number.parseInt(req.params.id, 10)
  const leagueIdRaw = req.query.leagueId
  const leagueId = leagueIdRaw == null || leagueIdRaw === '' ? null : Number.parseInt(String(leagueIdRaw), 10)

  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: 'Invalid player id' })
  }
  if (leagueIdRaw != null && leagueIdRaw !== '' && Number.isNaN(leagueId)) {
    return res.status(400).json({ error: 'leagueId must be a number when provided' })
  }

  try {
    const users = await queryUsersWithOptionalAvatar(
      `SELECT id, username, display_name, base_value, rating, avatar_image, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      `SELECT id, username, display_name, base_value, rating, '' AS avatar_image, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    )
    if (!users.length) {
      return res.status(404).json({ error: 'Player not found' })
    }

    const stats = await query(
      `SELECT COUNT(DISTINCT ss.match_id) AS matches_played,
              COALESCE(SUM(ss.goals), 0) AS goals,
              COALESCE(SUM(ss.assists), 0) AS assists,
              COALESCE(SUM(ss.saves), 0) AS saves,
              COALESCE(SUM(CASE WHEN ss.is_mvp = 1 THEN 1 ELSE 0 END), 0) AS mvp_trophies
       FROM stat_submissions ss
       WHERE ss.user_id = ?
         AND ss.status = 'approved'
         AND (? IS NULL OR ss.league_id = ?)`,
      [playerId, leagueId, leagueId]
    )

    const profileRows = await query(
      `SELECT main_archetype, total_worth, ovr, mvp_trophies, matches_played
       FROM player_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [playerId]
    )

    const user = users[0]
    const agg = stats[0] ?? {}
    const profile = profileRows[0] ?? null
    const matchesPlayed = Number(agg.matches_played) || 0
    const resolvedWorth =
      profile?.total_worth != null ? Number(profile.total_worth) : matchesPlayed > 0 ? Number(user.base_value) || 10 : 10
    const resolvedOvr = profile?.ovr != null ? Number(profile.ovr) : matchesPlayed > 0 ? Math.round((Number(user.rating) || 6) * 10) : 60

    return res.json({
      data: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        base_value: Number(user.base_value) || 10,
        rating: Number(user.rating) || 6,
        avatar_image: user.avatar_image || '',
        total_worth: Number.isFinite(resolvedWorth) ? resolvedWorth : 10,
        ovr: Number.isFinite(resolvedOvr) ? resolvedOvr : 60,
        main_archetype: profile?.main_archetype || 'None',
        matches_played: profile?.matches_played != null ? Number(profile.matches_played) : matchesPlayed,
        mvp_trophies: profile?.mvp_trophies != null ? Number(profile.mvp_trophies) : Number(agg.mvp_trophies) || 0,
        goals: Number(agg.goals) || 0,
        assists: Number(agg.assists) || 0,
        saves: Number(agg.saves) || 0,
      },
    })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.patch('/:id/avatar', async (req, res) => {
  const playerId = Number.parseInt(req.params.id, 10)
  const { avatarImage } = req.body
  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: 'Invalid player id' })
  }
  if (typeof avatarImage !== 'string') {
    return res.status(400).json({ error: 'avatarImage must be a string' })
  }
  if (avatarImage.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'avatarImage is too large' })
  }

  try {
    const users = await queryUsersWithOptionalAvatar(
      `SELECT id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      `SELECT id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    )
    if (!users.length) {
      return res.status(404).json({ error: 'Player not found' })
    }

    let result = null
    try {
      result = await query(
        `UPDATE users
         SET avatar_image = ?
         WHERE id = ?`,
        [avatarImage, playerId]
      )
    } catch (error) {
      if (!isMissingAvatarColumn(error)) throw error
      await ensureAvatarColumn()
      result = await query(
        `UPDATE users
         SET avatar_image = ?
         WHERE id = ?`,
        [avatarImage, playerId]
      )
    }
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Player not found' })
    }
    return res.json({ message: 'Avatar updated', data: { id: playerId, avatar_image: avatarImage } })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

router.get('/:id', async (req, res) => {
  const playerId = Number.parseInt(req.params.id, 10)
  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: 'Invalid player id' })
  }

  try {
    const players = await queryUsersWithOptionalAvatar(
      `SELECT id, username, display_name, base_value, rating, avatar_image, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      `SELECT id, username, display_name, base_value, rating, '' AS avatar_image, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [playerId]
    )

    if (!players.length) {
      return res.status(404).json({ error: 'Player not found' })
    }

    return res.json({ data: players[0] })
  } catch (error) {
    return handleSqlError(res, error)
  }
})

module.exports = router
