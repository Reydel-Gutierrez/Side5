import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PlayerRow from '../components/PlayerRow'
import PrimaryButton from '../components/PrimaryButton'
import RoleChip from '../components/RoleChip'
import SecondaryButton from '../components/SecondaryButton'
import TeamBudgetCard from '../components/TeamBudgetCard'
import { useMockApp } from '../context/MockAppContext'
import { sessionRosterIds } from '../utils/sessionRoster'

function Draft() {
  const { sessionId } = useParams()
  const { sessions, players, sessionTeams, addPlayerToTeam, balanceTeams, canManageSession, getLeaguePlayers } =
    useMockApp()
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [message, setMessage] = useState('')

  const session = sessions.find((item) => item.id === sessionId)
  if (!session) return <Navigate to="/sessions" replace />

  const canManage = canManageSession(session.id)
  const teams = sessionTeams[session.id] ?? []
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0]
  const draftedIds = new Set(teams.flatMap((team) => team.playerIds))
  const rosterIds = sessionRosterIds(session)
  const leaguePlayers = getLeaguePlayers(session.leagueId)
  const effectivePlayers = leaguePlayers.length ? leaguePlayers : players
  const availablePlayers = effectivePlayers.filter(
    (player) => rosterIds.includes(player.id) && !draftedIds.has(player.id),
  )
  const playerMap = useMemo(() => Object.fromEntries(effectivePlayers.map((player) => [player.id, player])), [effectivePlayers])

  const decoratedTeams = teams.map((team) => ({ ...team, captainName: playerMap[team.captainId]?.name ?? '-' }))

  const onAdd = (playerId) => {
    const result = addPlayerToTeam(session.id, selectedTeam.id, playerId)
    setMessage(result.ok ? 'Player added.' : result.reason)
  }

  const onBalance = () => {
    const result = balanceTeams(session.id)
    setMessage(result.ok ? 'Teams balanced fairly by value.' : result.reason)
  }

  if (!canManage) {
    return (
      <div className="screen">
        <PageHeader title="Draft" subtitle={session.title} />
        <section className="card">
          <p className="meta">Only league owners and managers can access the draft for this session.</p>
          <Link to={`/sessions/${session.id}`}>
            <PrimaryButton className="w-full">Back to session</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="screen">
      <PageHeader title="Draft" subtitle={session.title} />

      <div className="team-cards-grid">
        {decoratedTeams.map((team) => (
          <TeamBudgetCard
            key={team.id}
            team={team}
            budgetLimit={session.budgetPerTeam}
            selected={selectedTeam?.id === team.id}
            onSelect={() => setSelectedTeamId(team.id)}
          />
        ))}
      </div>

      <section className="card">
        <p className="session-title">{selectedTeam?.name}</p>
        <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RoleChip role="captain" />
          <span>{playerMap[selectedTeam?.captainId]?.name}</span>
        </p>
        <div className="screen-stack">
          {selectedTeam?.playerIds?.length ? (
            selectedTeam.playerIds.map((playerId) => (
              <PlayerRow key={playerId} player={playerMap[playerId]} rightContent={<span>${playerMap[playerId].value}M</span>} />
            ))
          ) : (
            <p className="meta">No players selected yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <p className="session-title">Available Players</p>
        <div className="screen-stack">
          {availablePlayers.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              rightContent={
                <button type="button" className="add-btn" onClick={() => onAdd(player.id)}>
                  +
                </button>
              }
            />
          ))}
        </div>
      </section>

      <div className="button-row">
        <SecondaryButton onClick={onBalance}>Auto Balance Teams</SecondaryButton>
        <Link to={`/teams-locked/${session.id}`}>
          <PrimaryButton className="w-full">Lock Teams</PrimaryButton>
        </Link>
      </div>

      {message ? <p className="meta">{message}</p> : null}
    </div>
  )
}

export default Draft
