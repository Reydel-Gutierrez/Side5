import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PlayerRow from '../components/PlayerRow'
import PrimaryButton from '../components/PrimaryButton'
import RoleChip from '../components/RoleChip'
import SecondaryButton from '../components/SecondaryButton'
import { useMockApp } from '../context/MockAppContext'
import { sessionRosterIds } from '../utils/sessionRoster'

function sortMembersForDisplay(rows, playersByUserId) {
  const order = { owner: 0, manager: 1, player: 2 }
  return [...rows].sort((a, b) => {
    const ra = order[a.role] ?? 9
    const rb = order[b.role] ?? 9
    if (ra !== rb) return ra - rb
    const na = playersByUserId[a.userId]?.name ?? ''
    const nb = playersByUserId[b.userId]?.name ?? ''
    return na.localeCompare(nb)
  })
}

function LeagueDetail() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const {
    leaguesDisplay,
    sessions,
    leagueMembers,
    players,
    users,
    currentUserId,
    myLeagueIds,
    getLeagueMemberRole,
    canManageLeague,
    leaveLeague,
    promoteToManager,
  } = useMockApp()
  const league = leaguesDisplay.find((l) => l.id === leagueId)
  if (!league) return <Navigate to="/leagues" replace />
  if (!myLeagueIds.includes(league.id)) return <Navigate to="/leagues" replace />

  const leagueSessions = sessions
    .filter((s) => s.leagueId === league.id)
    .sort((a, b) => `${b.dateIso}T${b.time24}`.localeCompare(`${a.dateIso}T${a.time24}`))

  const membersForLeague = leagueMembers.filter((lm) => lm.leagueId === league.id)
  const playersByUserId = Object.fromEntries(
    users.map((u) => {
      const pl = players.find((p) => p.id === u.playerId)
      return [u.id, pl ? { ...pl, user: u } : null]
    }),
  )
  const sortedMembers = sortMembersForDisplay(membersForLeague, playersByUserId)
  const myRole = currentUserId ? getLeagueMemberRole(league.id, currentUserId) : null
  const isOwner = myRole === 'owner'

  return (
    <div className="screen">
      <PageHeader title={league.name} />

      <section className="card">
        <p className="meta">{league.description}</p>
        <p className="meta invite-code-line">
          Invite code: <span className="invite-code">{league.inviteCode}</span>
        </p>
        <p className="meta">
          {league.memberCount} players · {league.sessionCount} sessions
        </p>
        {canManageLeague(league.id) ? (
          <div className="button-row">
            <Link to="/sessions?new=1" className="w-full">
              <PrimaryButton className="w-full">Create Session</PrimaryButton>
            </Link>
          </div>
        ) : null}
        {myRole ? (
          <div className="button-row" style={{ marginTop: 8 }}>
            {!confirmLeaveOpen ? (
              <SecondaryButton type="button" className="w-full" onClick={() => setConfirmLeaveOpen(true)}>
                Leave League
              </SecondaryButton>
            ) : (
              <>
                <SecondaryButton type="button" className="w-full" onClick={() => setConfirmLeaveOpen(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  type="button"
                  className="w-full"
                  onClick={() => {
                    const result = leaveLeague(league.id)
                    if (!result.ok) {
                      window.alert(result.reason)
                      return
                    }
                    navigate('/leagues', { replace: true })
                  }}
                >
                  Confirm Leave
                </PrimaryButton>
              </>
            )}
          </div>
        ) : null}
      </section>

      <p className="section-label">Members</p>
      <section className="card">
        <div className="screen-stack">
          {sortedMembers.map((lm) => {
            const row = playersByUserId[lm.userId]
            if (!row) return null
            return (
              <div key={lm.id} className="league-member-row">
                <PlayerRow player={row} rightContent={<RoleChip role={lm.role} />} />
                {isOwner && lm.role === 'player' && lm.userId !== currentUserId ? (
                  <SecondaryButton
                    type="button"
                    className="header-cta"
                    onClick={() => {
                      const r = promoteToManager(league.id, lm.userId)
                      if (!r.ok) window.alert(r.reason)
                    }}
                  >
                    Promote to Manager
                  </SecondaryButton>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <p className="section-label">Sessions in this league</p>
      {leagueSessions.length === 0 ? (
        <section className="card">
          <p className="meta">No sessions yet. Create one from Sessions or from this page.</p>
        </section>
      ) : (
        <ul className="list-plain">
          {leagueSessions.map((session) => (
            <li key={session.id} className="card list-card-tight">
              <p className="session-title">{session.title}</p>
              <p className="meta">
                {session.date} · {session.time}
              </p>
              <p className="meta">
                {sessionRosterIds(session).length} / {session.maxPlayers ?? 10} players · {session.status.replace('_', ' ')}
              </p>
              <Link to={`/sessions/${session.id}`}>
                <SecondaryButton className="w-full">Open</SecondaryButton>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default LeagueDetail
