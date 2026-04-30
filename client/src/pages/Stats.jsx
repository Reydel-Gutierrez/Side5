import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PlayerRow from '../components/PlayerRow'
import Tabs from '../components/Tabs'
import { apiFetch } from '../utils/apiFetch'

const statsTabs = [
  { id: 'players', label: 'Players' },
  { id: 'teams', label: 'Teams' },
]

function Stats() {
  const [activeTab, setActiveTab] = useState('players')
  const [players, setPlayers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadPlayers = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await apiFetch('/api/players')
        if (!active) return
        setPlayers(Array.isArray(response?.data) ? response.data : [])
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Failed to load players.')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadPlayers()
    return () => {
      active = false
    }
  }, [])

  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
  }, [players])

  return (
    <div className="screen">
      <PageHeader title="Leaderboard" />

      <p className="meta stats-disclaimer">Stats are calculated from approved match submissions only.</p>

      <Tabs tabs={statsTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'players' ? (
        <section className="card">
          <p className="session-title stats-league-heading">Players</p>
          {isLoading ? (
            <p className="meta">Loading...</p>
          ) : error ? (
            <p className="meta">{error}</p>
          ) : rankedPlayers.length === 0 ? (
            <p className="meta">No players found.</p>
          ) : (
            rankedPlayers.map((player, index) => (
              <Link key={player.id} to={`/players/${player.id}`}>
                <PlayerRow
                  player={{
                    id: player.id,
                    initials: String(player.display_name || player.username || '')
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? '')
                      .join(''),
                    name: player.display_name || player.username,
                    value: Number(player.base_value || 0),
                  }}
                  rightContent={
                    <div className="rating-col">
                      <span>#{index + 1}</span>
                      <strong>{Number(player.rating || 0).toFixed(1)}</strong>
                    </div>
                  }
                />
              </Link>
            ))
          )}
        </section>
      ) : (
        <section className="card">
          <p className="session-title stats-league-heading">Teams</p>
          <p className="meta">No team stats yet. Create a session and lock teams to see team rankings.</p>
        </section>
      )}
    </div>
  )
}

export default Stats
