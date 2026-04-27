import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'
import { useState } from 'react'

const matchTabs = [
  { id: 'summary', label: 'Summary' },
  { id: 'stats', label: 'Stats' },
  { id: 'timeline', label: 'Timeline' },
]

function MatchResult() {
  const { matchId } = useParams()
  const { matches, players, canApproveStatsForMatch } = useMockApp()
  const [activeTab, setActiveTab] = useState('summary')

  const match = matches.find((item) => item.id === matchId)
  if (!match) return <Navigate to="/" replace />

  const getName = (playerId) => players.find((player) => player.id === playerId)?.name ?? 'Player'
  const canApprove = canApproveStatsForMatch(matchId)

  return (
    <div className="screen">
      <PageHeader title="Match Result" subtitle={`${match.date} · ${match.time}`} />

      <section className="card center-card">
        <div className="result-grid">
          <span className="crest">A</span>
          <span className="scoreline">
            {match.homeScore} - {match.awayScore}
          </span>
          <span className="crest">B</span>
        </div>
      </section>

      <Tabs tabs={matchTabs} activeTab={activeTab} onChange={setActiveTab} />

      <section className="card">
        <p className="session-title">MVP</p>
        <div className="player-row">
          <span>{getName(match.mvpPlayerId)}</span>
          <span>8.7</span>
        </div>

        <p className="meta">Goals</p>
        {match.goals.map((item) => (
          <div key={`g-${item.playerId}`} className="list-row">
            <span>{getName(item.playerId)}</span>
            <span>{item.count}</span>
          </div>
        ))}

        <p className="meta">Assists</p>
        {match.assists.map((item) => (
          <div key={`a-${item.playerId}`} className="list-row">
            <span>{getName(item.playerId)}</span>
            <span>{item.count}</span>
          </div>
        ))}

        <p className="meta">Saves</p>
        {match.saves.map((item) => (
          <div key={`s-${item.playerId}`} className="list-row">
            <span>{getName(item.playerId)}</span>
            <span>{item.count}</span>
          </div>
        ))}
      </section>

      <Link to={`/matches/${match.id}/submit-stats`}>
        <PrimaryButton className="w-full">Submit Your Stats</PrimaryButton>
      </Link>
      {canApprove ? (
        <Link to={`/matches/${match.id}/approve-stats`}>
          <button type="button" className="btn btn-secondary w-full">
            Approve Submitted Stats
          </button>
        </Link>
      ) : null}
    </div>
  )
}

export default MatchResult
