import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SectionLabel from '../components/SectionLabel'
import SessionCard from '../components/SessionCard'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

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
    getLeaguePlayers,
    getPlayerIdentity,
  } = useMockApp()
  const [inviteHint, setInviteHint] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [joinErr, setJoinErr] = useState('')
  const [dbSummary, setDbSummary] = useState(null)
  const match = matches[0]
  const currentHour = new Date().getHours()
  const timeGreeting = currentHour < 12 ? 'Good morning,' : currentHour < 18 ? 'Good afternoon,' : 'Good evening,'

  const inAnyLeague = myLeagueIds.length > 0
  const numericUserId = Number.parseInt(String(currentUser?.id ?? ''), 10)
  const isDbUser = !Number.isNaN(numericUserId) && String(numericUserId) === String(currentUser?.id ?? '')

  useEffect(() => {
    let cancelled = false
    if (!isDbUser || !currentUser?.id) {
      setDbSummary(null)
      return undefined
    }
    ;(async () => {
      try {
        const leagueId = activeLeague?.id
        const query = /^\d+$/.test(String(leagueId || '')) ? `?leagueId=${Number.parseInt(String(leagueId), 10)}` : ''
        const result = await apiFetch(`/api/players/${numericUserId}/summary${query}`, { cache: 'no-store' })
        if (!cancelled) setDbSummary(result?.data ?? null)
      } catch {
        if (!cancelled) setDbSummary(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDbUser, currentUser?.id, activeLeague?.id, numericUserId])

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

  const handleJoinInline = async () => {
    setJoinErr('')
    setJoinMsg('')
    const result = await joinLeague(joinCode)
    if (!result.ok) {
      setJoinErr(result.reason)
      return
    }
    const joinedName = result.league?.name ?? 'the league'
    setJoinMsg(`Joined ${joinedName}.`)
    setJoinCode('')
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  const fallbackMe = {
    id: String(currentUser.playerId ?? `home-${currentUser.id}`),
    value: 10,
    rating: 7,
    overall: 70,
    mvps: 0,
  }
  const leaguePlayers = activeLeague ? getLeaguePlayers(activeLeague.id) : players
  const me =
    leaguePlayers.find((player) => player.id === currentUser.playerId) ??
    players.find((player) => player.id === currentUser.playerId) ??
    fallbackMe
  const identity = getPlayerIdentity(me.id, activeLeague?.id ?? null)
  const heroOverall = Number(dbSummary?.ovr) || Math.round((me.overall ?? me.rating * 10) || 70)
  const heroInitials =
    currentUser.initials ||
    String(currentUser.displayName || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') ||
    'P'
  const heroArchetype = dbSummary?.main_archetype || (identity.hasVotes ? identity.mainArchetype : 'None')
  const heroWorth = Number(dbSummary?.total_worth ?? me.value ?? 10)
  const heroMvps = Number(dbSummary?.mvp_trophies ?? me.mvps ?? 0)
  const heroMatches = Number(dbSummary?.matches_played ?? me.games ?? 0)
  const heroAvatarImage = currentUser.avatarImage || dbSummary?.avatar_image || ''

  if (!inAnyLeague) {
    return (
      <div className="screen">
        <PageHeader
          title={
            <>
              SIDE<span className="page-title-brand-accent">5</span>
            </>
          }
          titleClassName="page-title--brand"
          subtitle="Draft your side. Run the game."
        />

        <section className="hero card hero-card-main">
          <div className="hero-card-main__top">
            <div className="hero-card-main__identity">
              <div className="hero-card-main__avatar-wrap">
                <div className="avatar avatar-xl hero-card-main__avatar">
                  {heroAvatarImage ? <img src={heroAvatarImage} alt="" className="hero-card-main__avatar-image" /> : heroInitials}
                </div>
                <span className="hero-card-main__overall-badge">{heroOverall}</span>
              </div>
              <div className="hero-card-main__identity-text">
                <p className="greeting-label">{timeGreeting}</p>
                <h2 className="hero-name">{currentUser.displayName}</h2>
              </div>
            </div>

            <aside className="hero-card-main__worth">
              <p className="hero-card-main__worth-label">TOTAL WORTH</p>
              <p className="hero-card-main__worth-value">${heroWorth.toFixed(1)}M</p>
              <p className="hero-card-main__ovr">OVR {heroOverall}</p>
              <svg className="hero-card-main__sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 28 L24 26 L42 16 L62 18 L80 9 L98 3" />
              </svg>
            </aside>
          </div>

          <div className="hero-card-main__stats">
            <article className="hero-card-main__stat">
              <p className="hero-card-main__stat-label">Main Archetype</p>
              <p className="hero-card-main__stat-value">{heroArchetype}</p>
            </article>
            <article className="hero-card-main__stat">
              <p className="hero-card-main__stat-label">MVP Trophies</p>
              <p className="hero-card-main__stat-value">{heroMvps}</p>
            </article>
            <article className="hero-card-main__stat">
              <p className="hero-card-main__stat-label">Matches Played</p>
              <p className="hero-card-main__stat-value">{heroMatches}</p>
            </article>
          </div>

          <p className="meta hero-card-main__empty-state">
            You are not in a league yet. Join with a code or create your own.
          </p>
        </section>

        <SectionLabel>Join a league</SectionLabel>
        <section className="card join-league-inline">
          <p className="meta">Ask your organizer for an invite code.</p>
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

        <SectionLabel>League</SectionLabel>
        <Link to="/league" className="w-full">
          <SecondaryButton type="button" className="w-full">
            Open League
          </SecondaryButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="screen">
      <PageHeader
        title={
          <>
            SIDE<span className="page-title-brand-accent">5</span>
          </>
        }
        titleClassName="page-title--brand"
        subtitle="Draft your side. Run the game."
      />

      <section className="hero card hero-card-main">
        <div className="hero-card-main__top">
          <div className="hero-card-main__identity">
            <div className="hero-card-main__avatar-wrap">
              <div className="avatar avatar-xl hero-card-main__avatar">
                {heroAvatarImage ? <img src={heroAvatarImage} alt="" className="hero-card-main__avatar-image" /> : heroInitials}
              </div>
              <span className="hero-card-main__overall-badge">{heroOverall}</span>
            </div>
            <div className="hero-card-main__identity-text">
              <p className="greeting-label">{timeGreeting}</p>
              <h2 className="hero-name">{currentUser.displayName}</h2>
            </div>
          </div>

          <aside className="hero-card-main__worth">
            <p className="hero-card-main__worth-label">TOTAL WORTH</p>
            <p className="hero-card-main__worth-value">${heroWorth.toFixed(1)}M</p>
            <p className="hero-card-main__ovr">OVR {heroOverall}</p>
            <svg className="hero-card-main__sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 28 L24 26 L42 16 L62 18 L80 9 L98 3" />
            </svg>
          </aside>
        </div>

        <div className="hero-card-main__stats">
          <article className="hero-card-main__stat">
            <p className="hero-card-main__stat-label">Main Archetype</p>
            <p className="hero-card-main__stat-value">{heroArchetype}</p>
          </article>
          <article className="hero-card-main__stat">
            <p className="hero-card-main__stat-label">MVP Trophies</p>
            <p className="hero-card-main__stat-value">{heroMvps}</p>
          </article>
          <article className="hero-card-main__stat">
            <p className="hero-card-main__stat-label">Matches Played</p>
            <p className="hero-card-main__stat-value">{heroMatches}</p>
          </article>
        </div>
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
              <Link to="/league" className="w-full">
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
        <Link to="/league" className="quick-action-card">
          <span className="quick-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M15 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
              <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
          <span>League Hub</span>
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
              MVP: {players.find((p) => p.id === match.mvpPlayerId)?.name ?? '?'} ?{' '}
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
