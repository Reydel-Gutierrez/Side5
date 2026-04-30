import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import RoleChip from '../components/RoleChip'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'

const teamTabs = [
  { id: 'ta', label: 'Team A' },
  { id: 'tb', label: 'Team B' },
  { id: 'tc', label: 'Team C' },
]

function TeamsLocked() {
  const { sessionId } = useParams()
  const { sessions, players, sessionTeams, lockTeams, matches, canManageSession } = useMockApp()
  const [activeTeam, setActiveTeam] = useState('ta')

  const session = sessions.find((item) => item.id === sessionId)
  const playerMap = useMemo(() => Object.fromEntries(players.map((player) => [player.id, player])), [players])

  const teams = session?.id ? sessionTeams[session.id] ?? [] : []
  const shownTeam = teams.find((team) => team.id.endsWith(activeTeam)) ?? teams[0]
  const match = session ? matches.find((item) => item.sessionId === session.id) ?? matches[0] : null

  useEffect(() => {
    if (!session || !canManageSession(session.id)) return
    lockTeams(session.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  if (!session) return <Navigate to="/sessions" replace />

  if (!canManageSession(session.id)) {
    return (
      <div className="screen">
        <PageHeader title="Teams Locked" />
        <section className="card">
          <p className="meta">Only league owners and managers can lock teams for this session.</p>
          <Link to={`/sessions/${session.id}`}>
            <PrimaryButton className="w-full">Back to session</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="screen">
      <PageHeader title="Teams Locked" />
      <section className="card center-card">
        <div className="lock-icon" aria-hidden="true">
          🔒
        </div>
        <p>All teams are locked. Get ready for the game.</p>
      </section>

      <Tabs tabs={teamTabs} activeTab={activeTeam} onChange={setActiveTeam} />

      <section className="card">
        <p className="session-title">{shownTeam?.name}</p>
        <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RoleChip role="captain" />
          <span>{playerMap[shownTeam?.captainId]?.name}</span>
        </p>
        <ul className="list-plain">
          {shownTeam?.playerIds?.map((playerId) => (
            <li key={playerId} className="list-row">
              <span>{playerMap[playerId]?.name}</span>
              <span className="meta">${playerMap[playerId]?.value.toFixed(1)}M</span>
            </li>
          ))}
        </ul>
        <p className="meta budget-line">Budget Used: ${shownTeam?.budgetUsed?.toFixed(1)}M</p>
      </section>

      {match ? (
        <Link to={`/matches/${match.id}`}>
          <PrimaryButton className="w-full">View Match Details</PrimaryButton>
        </Link>
      ) : null}
    </div>
  )
}

export default TeamsLocked
