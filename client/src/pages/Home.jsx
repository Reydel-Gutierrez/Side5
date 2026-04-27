import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SectionLabel from '../components/SectionLabel'
import SessionCard from '../components/SessionCard'
import { useMockApp } from '../context/MockAppContext'

function Home() {
  const {
    sessions,
    matches,
    players,
    activeLeague,
    currentUser,
    myLeagueIds,
    joinLeague,
    canManageLeague,
  } = useMockApp()
  const [inviteHint, setInviteHint] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [joinErr, setJoinErr] = useState('')
  const match = matches[0]

  const inAnyLeague = myLeagueIds.length > 0

  const nextSession =
    sessions
      .filter((s) => s.status !== 'completed')
      .sort((a, b) => `${a.dateIso}T${a.time24}`.localeCompare(`${b.dateIso}T${b.time24}`))[0] ?? sessions[0]

  const copyInvite = async () => {
    if (!activeLeague?.inviteCode) return
    try {
      await navigator.clipboard.writeText(activeLeague.inviteCode)
      setInviteHint('Copied invite code')
    } catch {
      setInviteHint(activeLeague.inviteCode)
    }
    setTimeout(() => setInviteHint(''), 2500)
  }

  const handleJoinInline = () => {
    setJoinErr('')
    setJoinMsg('')
    const result = joinLeague(joinCode)
    if (!result.ok) {
      setJoinErr(result.reason)
      return
    }
    setJoinMsg(`Joined ${result.league.name}.`)
    setJoinCode('')
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!inAnyLeague) {
    return (
      <div className="screen">
        <PageHeader title="SIDE5" subtitle="Draft your side. Run the game." />

        <section className="hero card">
          <p className="greeting-label">Welcome back,</p>
          <h2 className="hero-name">{currentUser.displayName}</h2>
          <p className="meta" style={{ marginTop: 8 }}>
            You are not in a league yet. Join with a code or create your own.
          </p>
        </section>

        <SectionLabel>Join a league</SectionLabel>
        <section className="card join-league-inline">
          <p className="meta">Ask your organizer for an invite code (try SIDE5-MON for the demo league).</p>
          <label className="field">
            <span className="field-label">Invite code</span>
            <input
              className="field-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="SIDE5-MON"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {joinErr ? <p className="form-error">{joinErr}</p> : null}
          {joinMsg ? <p className="meta toast-hint">{joinMsg}</p> : null}
          <PrimaryButton type="button" className="w-full" onClick={handleJoinInline}>
            Join League
          </PrimaryButton>
        </section>

        <SectionLabel>Organize</SectionLabel>
        <Link to="/leagues?create=1" className="w-full">
          <SecondaryButton type="button" className="w-full">
            Create League
          </SecondaryButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="screen">
      <PageHeader title="SIDE5" subtitle="Draft your side. Run the game." />

      <section className="hero card">
        <p className="greeting-label">Good evening,</p>
        <h2 className="hero-name">{currentUser.displayName}</h2>
      </section>

      {activeLeague ? (
        <>
          <SectionLabel>Your league</SectionLabel>
          <section className="card league-hero-card">
            <p className="session-title">{activeLeague.name}</p>
            <p className="meta">
              {activeLeague.memberCount} players ? {activeLeague.sessionCount} sessions
            </p>
            <p className="meta invite-code-line">
              Invite Code: <span className="invite-code">{activeLeague.inviteCode}</span>
            </p>
            {inviteHint ? <p className="meta toast-hint">{inviteHint}</p> : null}
            <div className="button-row">
              <Link to={`/leagues/${activeLeague.id}`} className="w-full">
                <SecondaryButton className="w-full">View League</SecondaryButton>
              </Link>
              {canManageLeague(activeLeague.id) ? (
                <PrimaryButton type="button" className="w-full" onClick={copyInvite}>
                  Invite Player
                </PrimaryButton>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <SectionLabel>Next Game</SectionLabel>
      {nextSession ? <SessionCard session={nextSession} showLeague /> : <p className="meta">No upcoming sessions.</p>}

      <SectionLabel>Quick Actions</SectionLabel>
      <div className="quick-actions-grid">
        <Link to="/leagues?create=1" className="quick-action-card">
          <span className="quick-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
          </span>
          <span>Create League</span>
        </Link>
        <Link to="/leagues?join=1" className="quick-action-card">
          <span className="quick-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>Join League</span>
        </Link>
        {activeLeague && canManageLeague(activeLeague.id) ? (
          <Link to="/sessions?new=1" className="quick-action-card">
            <span className="quick-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <span>Create Session</span>
          </Link>
        ) : null}
      </div>

      {match ? (
        <>
          <SectionLabel>Recent Result</SectionLabel>
          <section className="card">
            <p className="meta">
              {match.date} ? {match.time}
            </p>
            <div className="result-grid">
              <span className="team-name">Team A</span>
              <span className="scoreline">
                {match.homeScore} - {match.awayScore}
              </span>
              <span className="team-name text-right">Team B</span>
            </div>
            <p className="meta">
              MVP: {players.find((p) => p.id === match.mvpPlayerId)?.name ?? '?'} {' '}
              {players.find((p) => p.id === match.mvpPlayerId)?.rating?.toFixed(1) ?? '?'}
            </p>
            <Link to={`/matches/${match.id}`}>
              <PrimaryButton className="w-full">View Match Details</PrimaryButton>
            </Link>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default Home
