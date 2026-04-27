import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import JoinLeagueModal from '../components/JoinLeagueModal'
import ProfilePlayerLayout from '../components/ProfilePlayerLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SectionLabel from '../components/SectionLabel'
import { useMockApp } from '../context/MockAppContext'

function Profile() {
  const navigate = useNavigate()
  const { players, activeLeague, joinLeague, currentUser, logout, getLeagueMemberRole } = useMockApp()
  const [joinOpen, setJoinOpen] = useState(false)

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const me = players.find((p) => p.id === currentUser.playerId) ?? players[0]
  const myRoleInActive = activeLeague ? getLeagueMemberRole(activeLeague.id, currentUser.id) : null

  const accountDetails = {
    email: currentUser.email,
    username: currentUser.username,
    phone: currentUser.phone,
    memberSince: currentUser.memberSince,
    playerId: currentUser.playerId,
  }

  const leagueBlock = (
    <>
      <SectionLabel>Active league</SectionLabel>
      <section className="card profile-league-card">
        {activeLeague ? (
          <>
            <p className="session-title">{activeLeague.name}</p>
            {myRoleInActive ? (
              <p className="meta" style={{ marginBottom: 8 }}>
                Your role in this league: <strong style={{ textTransform: 'capitalize' }}>{myRoleInActive}</strong>
              </p>
            ) : null}
            <p className="meta invite-code-line">
              Invite: <span className="invite-code">{activeLeague.inviteCode}</span>
            </p>
            <p className="meta">
              {activeLeague.memberCount} players · {activeLeague.sessionCount} sessions
            </p>
            <div className="button-row">
              <Link to={`/leagues/${activeLeague.id}`} className="w-full">
                <SecondaryButton className="w-full">League hub</SecondaryButton>
              </Link>
              <PrimaryButton type="button" className="w-full" onClick={() => setJoinOpen(true)}>
                Join another league
              </PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <p className="meta">No active league selected.</p>
            <PrimaryButton type="button" className="w-full" onClick={() => setJoinOpen(true)}>
              Join a league
            </PrimaryButton>
            <Link to="/leagues" className="profile-inline-link">
              Browse all leagues
            </Link>
          </>
        )}
      </section>
    </>
  )

  return (
    <>
      <ProfilePlayerLayout
        player={me}
        backTo={null}
        accountDetails={accountDetails}
        identityExtra={
          <>
            <p className="meta profile-hero-handle">@{currentUser.username}</p>
            <p className="meta">Member since {currentUser.memberSince}</p>
            <div className="profile-logout-row">
              <SecondaryButton
                type="button"
                className="w-full"
                onClick={() => {
                  logout()
                  navigate('/', { replace: true })
                }}
              >
                Log out
              </SecondaryButton>
            </div>
          </>
        }
        afterRadar={leagueBlock}
      />
      <JoinLeagueModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoin={(code) => {
          const result = joinLeague(code)
          if (result.ok) {
            navigate(`/leagues/${result.league.id}`)
          }
          return result
        }}
      />
    </>
  )
}

export default Profile
