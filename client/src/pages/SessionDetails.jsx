import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PlayerRow from '../components/PlayerRow'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SessionFormModal from '../components/SessionFormModal'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'
import { sessionStatusTone } from '../utils/sessionStatus'
import { sessionRosterIds } from '../utils/sessionRoster'

function SessionDetails() {
  const { sessionId } = useParams()
  const {
    sessions,
    players,
    leaguesDisplay,
    confirmAttendance,
    updateSession,
    canManageSession,
    getLeagueMemberPlayerIds,
  } = useMockApp()
  const [editOpen, setEditOpen] = useState(false)

  const session = sessions.find((item) => item.id === sessionId)
  if (!session) return <Navigate to="/sessions" replace />

  const roster = players.filter((player) => sessionRosterIds(session).includes(player.id))
  const canManage = canManageSession(session.id)
  const memberCap = Math.max(1, getLeagueMemberPlayerIds(session.leagueId).length)

  return (
    <div className="screen">
      <PageHeader
        title={session.title}
        subtitle={`${session.date} · ${session.time}`}
        rightContent={
          canManage ? (
            <SecondaryButton type="button" className="header-cta" onClick={() => setEditOpen(true)}>
              Edit
            </SecondaryButton>
          ) : null
        }
      />

      {session.leagueName ? (
        <p className="meta session-league-line">League: {session.leagueName}</p>
      ) : null}

      <SessionFormModal
        open={editOpen}
        mode="edit"
        session={session}
        maxRoster={players.length}
        getLeagueMemberPlayerCount={(leagueId) => getLeagueMemberPlayerIds(leagueId).length}
        leagues={leaguesDisplay}
        defaultLeagueId={session.leagueId}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => {
          const result = updateSession(session.id, payload)
          if (!result.ok) {
            window.alert(result.reason)
            return
          }
          setEditOpen(false)
        }}
      />

      <section className="card">
        <p className="meta">{session.location}</p>
        <StatusChip tone={sessionStatusTone(session.status)}>{session.status.replace(/_/g, ' ')}</StatusChip>
        <div className="info-grid">
          <div>
            <p className="meta">Format</p>
            <p>{session.format}</p>
          </div>
          <div>
            <p className="meta">Budget</p>
            <p>${session.budgetPerTeam}M / team</p>
          </div>
          <div>
            <p className="meta">Teams</p>
            <p>3</p>
          </div>
          <div>
            <p className="meta">Players</p>
            <p>
              {sessionRosterIds(session).length} / {session.maxPlayers ?? 10}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="session-title">Players</p>
        <p className="meta">Roster is limited to confirmed league members ({memberCap} in this league).</p>
        <div className="screen-stack">
          {roster.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              rightContent={<span className={`status-chip status-chip-${player.status}`}>{player.status}</span>}
            />
          ))}
        </div>
      </section>

      <div className="button-row">
        <SecondaryButton onClick={() => confirmAttendance(session.id)}>Confirm Attendance</SecondaryButton>
        {canManage ? (
          <Link to={`/draft/${session.id}`}>
            <PrimaryButton className="w-full">Start Draft</PrimaryButton>
          </Link>
        ) : (
          <PrimaryButton className="w-full" disabled title="Only league owners and managers can run the draft">
            Start Draft
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}

export default SessionDetails
