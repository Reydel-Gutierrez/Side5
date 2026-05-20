import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'
import { fetchLeaderboardFromApi, mapApiLeaderboardPlayer } from '../utils/leaderboardApi'

const LEADERBOARD_TABS = [
  { id: 'rating', label: 'Rating' },
  { id: 'goals', label: 'Goals' },
  { id: 'mvp', label: 'MVP' },
  { id: 'matches', label: 'Matches' },
]

const TABLE_CONFIG = {
  rating: { hint: 'Sorted by rating, then matches played, then goals.' },
  goals: { hint: 'Sorted by goals scored in this league.' },
  mvp: { hint: 'Sorted by MVP awards in this league.' },
  matches: { hint: 'Sorted by matches played in this league.' },
}

function initialsFromName(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function formatRating(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number(value).toFixed(1)
}

function normalizePlayer(raw) {
  return {
    id: raw.id,
    name: raw.name,
    initials: raw.initials || initialsFromName(raw.name),
    rating: Number(raw.rating) || 6,
    matchesPlayed: Number(raw.matchesPlayed) || 0,
    goals: Number(raw.goals) || 0,
    wins: Number(raw.wins) || 0,
    losses: Number(raw.losses) || 0,
    mvp: Number(raw.mvp) || 0,
  }
}

function sortValueFor(player, sortKey) {
  if (sortKey === 'rating') return player.rating
  if (sortKey === 'mvp') return player.mvp
  if (sortKey === 'goals') return player.goals
  if (sortKey === 'matches') return player.matchesPlayed
  return 0
}

function rankPlayers(players, sortKey) {
  const sorted = [...players].sort((a, b) => {
    const diff = sortValueFor(b, sortKey) - sortValueFor(a, sortKey)
    if (diff !== 0) return diff
    if (sortKey !== 'rating') return b.rating - a.rating
    return b.goals - a.goals
  })
  return sorted
}

function LeaderboardTable({ players, sortKey }) {
  const rows = useMemo(() => rankPlayers(players, sortKey), [players, sortKey])
  const config = TABLE_CONFIG[sortKey]

  return (
    <div className="leaderboard-table-wrap" role="tabpanel">
      <table className="leaderboard-table leaderboard-table--full">
        <thead>
          <tr>
            <th scope="col" className="leaderboard-table__rank">
              #
            </th>
            <th scope="col" className="leaderboard-table__name">
              Player
            </th>
            <th scope="col" className="leaderboard-table__stat">
              Rating
            </th>
            <th scope="col" className="leaderboard-table__stat">
              MP
            </th>
            <th scope="col" className="leaderboard-table__stat">
              G
            </th>
            <th scope="col" className="leaderboard-table__stat">
              W-L
            </th>
            <th scope="col" className="leaderboard-table__stat">
              MVP
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player, index) => (
            <tr key={player.id}>
              <td className="leaderboard-table__rank">{index + 1}</td>
              <td className="leaderboard-table__name">
                <Link to={`/players/${player.id}`} className="leaderboard-name-link">
                  <span className="avatar leaderboard-name-link__avatar">{player.initials}</span>
                  <span className="leaderboard-name-link__text">{player.name}</span>
                </Link>
              </td>
              <td
                className={`leaderboard-table__stat${sortKey === 'rating' ? ' leaderboard-table__stat--active' : ''}`}
              >
                <span className="leaderboard-stat-value">{formatRating(player.rating)}</span>
              </td>
              <td
                className={`leaderboard-table__stat${sortKey === 'matches' ? ' leaderboard-table__stat--active' : ''}`}
              >
                <span className="leaderboard-stat-value">{player.matchesPlayed}</span>
              </td>
              <td
                className={`leaderboard-table__stat${sortKey === 'goals' ? ' leaderboard-table__stat--active' : ''}`}
              >
                <span className="leaderboard-stat-value">{player.goals}</span>
              </td>
              <td className="leaderboard-table__stat">
                <span className="leaderboard-stat-value">
                  {player.wins}-{player.losses}
                </span>
              </td>
              <td
                className={`leaderboard-table__stat${sortKey === 'mvp' ? ' leaderboard-table__stat--active' : ''}`}
              >
                <span className="leaderboard-stat-value">{player.mvp}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta leaderboard-sort-hint">{config.hint}</p>
    </div>
  )
}

function Stats() {
  const { activeLeague, activeLeagueId, currentUserId, refreshLeaguesFromApi } = useMockApp()
  const [players, setPlayers] = useState([])
  const [leagueName, setLeagueName] = useState(null)
  const [activeTab, setActiveTab] = useState('rating')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [contextNote, setContextNote] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async (showLoading = true) => {
      if (showLoading) setIsLoading(true)
      setError('')
      setContextNote('')

      try {
        await refreshLeaguesFromApi()
        if (cancelled) return

        const payload = await fetchLeaderboardFromApi({
          activeLeagueId: activeLeague?.id ?? activeLeagueId,
          userId: currentUserId,
        })
        if (cancelled) return

        console.log('[Stats] leaderboard response', payload)

        const rawPlayers = payload?.data?.players
        const list = Array.isArray(rawPlayers)
          ? rawPlayers.map((row) => normalizePlayer(mapApiLeaderboardPlayer(row)))
          : []

        setPlayers(list)
        setLeagueName(payload?.data?.league_name ?? activeLeague?.name ?? null)

        if (payload?.data?.league_id == null) {
          setContextNote('Join a league to see league-specific stats.')
        }
      } catch (requestError) {
        if (cancelled) return
        setError(requestError.message || 'Failed to load leaderboard.')
        setPlayers([])
        setLeagueName(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run(true)

    const intervalId = window.setInterval(() => run(false), 15000)

    const onFocus = () => {
      if (!cancelled) run(false)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) run(false)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeLeague?.id, activeLeagueId, currentUserId, refreshLeaguesFromApi])

  const heading = leagueName ? `${leagueName} — Players` : 'Players'

  return (
    <div className="screen">
      <PageHeader title="Leaderboard" />

      <p className="meta stats-disclaimer">
        League stats come from your league roster. New players start at 6.0 until they play a match.
      </p>

      <section className="card stats-leaderboard-card">
        <p className="session-title stats-league-heading">{heading}</p>
        {contextNote ? <p className="meta stats-leaderboard-note">{contextNote}</p> : null}

        <Tabs tabs={LEADERBOARD_TABS} activeTab={activeTab} onChange={setActiveTab} />

        {isLoading ? (
          <p className="meta">Loading...</p>
        ) : error ? (
          <p className="meta">{error}</p>
        ) : players.length === 0 ? (
          <p className="meta">No players found.</p>
        ) : (
          LEADERBOARD_TABS.map((tab) =>
            activeTab === tab.id ? <LeaderboardTable key={tab.id} players={players} sortKey={tab.id} /> : null,
          )
        )}
      </section>
    </div>
  )
}

export default Stats
