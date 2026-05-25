const express = require('express')

const { query } = require('../db/pool')

const { fetchGlobalLeaderboard } = require('../queries/leaderboard')

const { buildPlayerSummary } = require('../queries/playerSummary')



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

       ORDER BY display_name ASC`,

    )

    return res.json({ data: players, count: players.length })

  } catch (error) {

    return handleSqlError(res, error)

  }

})



router.get('/leaderboard', async (_req, res) => {

  try {

    const players = await fetchGlobalLeaderboard()

    return res.json({

      data: {

        league_id: null,

        league_name: null,

        players,

        count: players.length,

      },

    })

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

    const summary = await buildPlayerSummary(playerId, leagueId)

    if (!summary) {

      const users = await queryUsersWithOptionalAvatar(

        `SELECT id, username, display_name, base_value, rating, avatar_image, created_at

         FROM users WHERE id = ? LIMIT 1`,

        `SELECT id, username, display_name, base_value, rating, '' AS avatar_image, created_at

         FROM users WHERE id = ? LIMIT 1`,

        [playerId],

      )

      if (!users.length) {

        return res.status(404).json({ error: 'Player not found' })

      }

      const user = users[0]

      const rating = Number(user.rating) || 6

      const worth = Number(user.base_value) || 10

      return res.json({

        data: {

          id: user.id,

          username: user.username,

          display_name: user.display_name,

          avatar_image: user.avatar_image || '',

          league_id: null,

          rating,

          player_worth: worth,

          base_value: worth,

          total_worth: worth,

          ovr: Math.round(rating * 10),

          main_archetype: 'None',
          archetype_description: null,
          style_counters: {},
          style_radar: [],
          has_style_data: false,

          matches_played: 0,

          goals: 0,

          wins: 0,

          losses: 0,

          mvp_trophies: 0,

          assists: 0,

          saves: 0,

        },

      })

    }



    res.set('Cache-Control', 'no-store, no-cache, must-revalidate')

    return res.json({ data: summary })

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

      `SELECT id FROM users WHERE id = ? LIMIT 1`,

      `SELECT id FROM users WHERE id = ? LIMIT 1`,

      [playerId],

    )

    if (!users.length) {

      return res.status(404).json({ error: 'Player not found' })

    }



    let result = null

    try {

      result = await query(`UPDATE users SET avatar_image = ? WHERE id = ?`, [avatarImage, playerId])

    } catch (error) {

      if (!isMissingAvatarColumn(error)) throw error

      await ensureAvatarColumn()

      result = await query(`UPDATE users SET avatar_image = ? WHERE id = ?`, [avatarImage, playerId])

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

       FROM users WHERE id = ? LIMIT 1`,

      `SELECT id, username, display_name, base_value, rating, '' AS avatar_image, created_at

       FROM users WHERE id = ? LIMIT 1`,

      [playerId],

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

