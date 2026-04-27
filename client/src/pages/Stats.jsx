import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PlayerRow from '../components/PlayerRow'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'

const statsTabs = [
  { id: 'players', label: 'Players' },
  { id: 'teams', label: 'Teams' },
]

function Stats() {
  const [activeTab, setActiveTab] = useState('players')
  const [statsLeagueId, setStatsLeagueId] = useState(() => null)
  const { leaguesDisplay, activeLeagueId, myLeagueIds, sessions, sessionTeams, getLeaguePlayers } = useMockApp()

  const selectedLeagueId = statsLeagueId ?? activeLeagueId ?? myLeagueIds[0] ?? null

  const rankedPlayers = useMemo(() => {
    const pool = getLeaguePlayers(selectedLeagueId)
    return [...pool].sort((a, b) => b.rating - a.rating)
  }, [getLeaguePlayers, selectedLeagueId])

  const leagueName = leaguesDisplay.find((l) => l.id === selectedLeagueId)?.name ?? 'League'
  const inAnyLeague = myLeagueIds.length > 0

  const rankedTeams = useMemo(() => {
    if (!selectedLeagueId) return []
    const leagueSessionIds = sessions.filter((s) => s.leagueId === selectedLeagueId).map((s) => s.id)
    const aggregate = new Map()
    leagueSessionIds.forEach((sessionId) => {
      const teamsForSession = sessionTeams[sessionId] ?? []
      teamsForSession.forEach((team) => {
        const current = aggregate.get(team.name) ?? { name: team.name, budgetUsedTotal: 0, appearances: 0 }
        current.budgetUsedTotal += Number(team.budgetUsed) || 0
        current.appearances += 1
        aggregate.set(team.name, current)
      })
    })
    return Array.from(aggregate.values())
      .map((team) => ({
        ...team,
        rating: team.appearances ? team.budgetUsedTotal / team.appearances : 0,
      }))
      .sort((a, b) => b.rating - a.rating)
  }, [selectedLeagueId, sessions, sessionTeams])

  return (
    <div className="screen">
      <PageHeader title="Leaderboard" />

      {inAnyLeague ? (
        <label className="field league-filter-field">
          <span className="field-label">League</span>
          <select
            className="field-input"
            value={selectedLeagueId ?? ''}
            onChange={(e) => setStatsLeagueId(e.target.value)}
          >
            {leaguesDisplay
              .filter((lg) => myLeagueIds.includes(lg.id))
              .map((lg) => (
                <option key={lg.id} value={lg.id}>
                  {lg.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      <p className="meta stats-disclaimer">Stats are calculated from approved match submissions only.</p>

      <Tabs tabs={statsTabs} activeTab={activeTab} onChange={setActiveTab} />

      {!inAnyLeague ? (
        <section className="card">
          <p className="session-title stats-league-heading">No league selected</p>
          <p className="meta">Join or create a league to view player and team stats.</p>
        </section>
      ) : activeTab === 'players' ? (
        <section className="card">
          <p className="session-title stats-league-heading">{leagueName}</p>
          {rankedPlayers.length === 0 ? (
            <p className="meta">No members in this league yet. Join the league to appear here.</p>
          ) : (
            rankedPlayers.map((player, index) => (
              <Link key={player.id} to={`/players/${player.id}`}>
                <PlayerRow
                  player={player}
                  rightContent={
                    <div className="rating-col">
                      <span>#{index + 1}</span>
                      <strong>{player.rating.toFixed(1)}</strong>
                    </div>
                  }
                />
              </Link>
            ))
          )}
        </section>
      ) : (
        <section className="card">
          <p className="session-title stats-league-heading">{leagueName}</p>
          {rankedTeams.length === 0 ? (
            <p className="meta">No team stats yet. Create a session and lock teams to see team rankings.</p>
          ) : (
            rankedTeams.map((team) => (
              <div key={team.name} className="list-row">
                <span>{team.name}</span>
                <span>Rating {team.rating.toFixed(1)}</span>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  )
}

export default Stats
