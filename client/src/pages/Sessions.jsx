import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SessionCard from '../components/SessionCard'
import SessionFormModal from '../components/SessionFormModal'
import StatusChip from '../components/StatusChip'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'
import {
  fetchRosterMetaForSessions,
  isPastSession,
  mapSessionForDisplay,
  mergeSessionRosterMeta,
} from '../utils/sessionListHelpers'
import { sessionRosterCount } from '../utils/sessionRoster'
import { sessionStatusTone } from '../utils/sessionStatus'

const sessionTabs = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function SessionsSectionHead({ icon, children }) {
  return (
    <div className="home-section-head profile-section-head">
      <span className="home-section-head__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="home-section-head__label">{children}</p>
    </div>
  )
}

function isObviousTestLeagueName(name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return false
  if (n === 'monday test' || n === 'monday test league') return true
  if (/\btest\s+league\b/i.test(String(name || ''))) return true
  return false
}

function pickSingleLeagueRow(rows, preferLeagueId) {
  const list = Array.isArray(rows) ? rows : []
  const nonTest = list.filter((r) => !isObviousTestLeagueName(r.name))
  const pool = nonTest.length ? nonTest : list
  if (!pool.length) return null
  if (preferLeagueId != null && String(preferLeagueId).trim() !== '') {
    const hit = pool.find((r) => String(r.id) === String(preferLeagueId))
    if (hit) return hit
  }
  return pool[0]
}

function Sessions() {
  const { createSession, canManageLeague, refreshLeaguesFromApi, activeLeague } = useMockApp()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [formOpen, setFormOpen] = useState(false)
  const [sessions, setSessions] = useState([])
  const [pastSessions, setPastSessions] = useState([])
  const [rosterMeta, setRosterMeta] = useState({})
  const [leagues, setLeagues] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const loadInFlightRef = useRef(false)

  const loadData = useCallback(async () => {
    if (loadInFlightRef.current) return
    loadInFlightRef.current = true
    setIsLoading(true)
    try {
      const sessionsResult = await apiFetch('/api/sessions', { cache: 'no-store' })
      const allSessionRows = Array.isArray(sessionsResult?.data) ? sessionsResult.data : []

      let myLeagues = []
      let primaryLeagueId = null
      let uid = null
      try {
        const rawUser = window.localStorage.getItem('currentUser')
        const u = rawUser ? JSON.parse(rawUser) : null
        const parsed = Number.parseInt(String(u?.id ?? ''), 10)
        if (!Number.isNaN(parsed) && String(parsed) === String(u?.id ?? '')) {
          uid = parsed
          const mine = await apiFetch(`/api/leagues/mine?userId=${uid}`, { cache: 'no-store' })
          const rows = Array.isArray(mine?.data) ? mine.data : []
          const picked = pickSingleLeagueRow(rows, activeLeague?.id)
          if (picked) {
            primaryLeagueId = picked.id
            myLeagues = [
              {
                id: picked.id,
                name: picked.name ?? '',
                myRole: String(picked.my_role ?? picked.myRole ?? '').toLowerCase(),
                memberCount: Number(picked.member_count) || 0,
              },
            ]
          }
        }
      } catch {
        myLeagues = []
      }

      const sessionRows =
        primaryLeagueId != null
          ? allSessionRows.filter((s) => String(s.league_id) === String(primaryLeagueId))
          : allSessionRows

      const formattedSessions = sessionRows.map(mapSessionForDisplay)
      setSessions(formattedSessions)
      setLeagues(myLeagues)

      let pastRows = []
      if (primaryLeagueId != null && uid != null) {
        try {
          const pastRes = await apiFetch(
            `/api/leagues/${primaryLeagueId}/sessions/past?userId=${uid}`,
            { cache: 'no-store' },
          )
          pastRows = Array.isArray(pastRes?.data) ? pastRes.data : []
        } catch {
          pastRows = formattedSessions.filter(isPastSession)
        }
      } else {
        pastRows = formattedSessions.filter(isPastSession)
      }
      setPastSessions(pastRows.map(mapSessionForDisplay))

      const fallbackMax = Math.max(10, Number(myLeagues[0]?.memberCount) || 10)
      const meta = await fetchRosterMetaForSessions(
        [...formattedSessions, ...pastRows.map(mapSessionForDisplay)],
        fallbackMax,
      )
      setRosterMeta(meta)
    } catch {
      setSessions([])
      setPastSessions([])
      setLeagues([])
      setRosterMeta({})
    } finally {
      setIsLoading(false)
      loadInFlightRef.current = false
    }
  }, [activeLeague?.id])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true)
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('tab') === 'past') {
      setActiveTab('past')
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await refreshLeaguesFromApi?.()
      if (!cancelled) await loadData()
    }
    run()

    const intervalId = window.setInterval(() => {
      if (!cancelled) loadData()
    }, 30000)
    const onFocus = () => {
      if (!cancelled) loadData()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) loadData()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadData, refreshLeaguesFromApi])

  const canShowCreate = useMemo(
    () =>
      leagues.some(
        (lg) =>
          lg.myRole === 'owner' ||
          lg.myRole === 'manager' ||
          canManageLeague(String(lg.id)),
      ),
    [leagues, canManageLeague],
  )

  const defaultLeagueId = useMemo(() => leagues[0]?.id ?? null, [leagues])

  const displaySessions = useMemo(
    () => sessions.map((session) => mergeSessionRosterMeta(session, rosterMeta)),
    [sessions, rosterMeta],
  )

  const upcoming = displaySessions.filter((session) => !isPastSession(session))
  const past = useMemo(
    () => pastSessions.map((session) => mergeSessionRosterMeta(session, rosterMeta)),
    [pastSessions, rosterMeta],
  )

  const handleCreate = async (payload) => {
    const result = await createSession(payload)
    if (!result.ok) {
      window.alert(result.reason || 'Could not create session.')
      return
    }
    setFormOpen(false)
    await loadData()
    if (result.id) {
      navigate(`/sessions/${result.id}`, { replace: false })
    }
  }

  const leagueName = leagues[0]?.name

  return (
    <div className="screen sessions-screen">
      <header className="profile-page-brand sessions-page-brand">
        <div className="profile-page-brand__texture" aria-hidden="true" />
        <h1 className="profile-page-brand__title">
          Game <span className="profile-page-brand__accent">Sessions</span>
        </h1>
        <p className="profile-page-brand__tagline">
          {leagueName ? (
            <>
              {leagueName} · <span className="profile-page-brand__tagline-accent">Pick your next match.</span>
            </>
          ) : (
            <>
              Your schedule. <span className="profile-page-brand__tagline-accent">Show up and play.</span>
            </>
          )}
        </p>
      </header>

      {leagueName ? (
        <section className="card home-league-card sessions-league-card">
          <div className="home-dashboard-card__body">
            <div className="home-dashboard-card__icon home-dashboard-card__icon--league" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3 4 6.5v5.8c0 4.8 3.4 9.3 8 10.7 4.6-1.4 8-5.9 8-10.7V6.5L12 3Z" />
              </svg>
            </div>
            <div className="home-dashboard-card__content">
              <p className="home-dashboard-card__title">{leagueName}</p>
              <p className="home-dashboard-card__meta">
                {upcoming.length} upcoming · {past.length} past
              </p>
            </div>
          </div>
          {canShowCreate ? (
            <PrimaryButton type="button" className="w-full home-btn-primary" onClick={() => setFormOpen(true)}>
              <span className="home-btn__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="4" y="5" width="16" height="14" rx="2.5" />
                  <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16M12 13v4M10 15h4" strokeLinecap="round" />
                </svg>
              </span>
              Create Session
            </PrimaryButton>
          ) : null}
        </section>
      ) : !isLoading ? (
        <section className="card profile-panel-card sessions-empty-league">
          <p className="meta home-empty-hint">Join a league from Home to see sessions here.</p>
          <Link to="/">
            <SecondaryButton type="button" className="w-full home-btn-secondary">
              Go to Home
            </SecondaryButton>
          </Link>
        </section>
      ) : null}

      <SessionFormModal
        open={formOpen}
        mode="create"
        session={null}
        maxRoster={0}
        getLeagueMemberPlayerCount={() => 0}
        leagues={leagues}
        defaultLeagueId={defaultLeagueId}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      <div className="profile-tabs-panel card sessions-tabs-panel">
        <Tabs tabs={sessionTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'upcoming' ? (
        <>
          <SessionsSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="5" width="16" height="14" rx="2.5" />
                <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" strokeLinecap="round" />
              </svg>
            }
          >
            Upcoming
          </SessionsSectionHead>
          {isLoading ? (
            <section className="card profile-panel-card sessions-loading-card">
              <p className="meta">Loading sessions…</p>
            </section>
          ) : null}
          {!isLoading && upcoming.length === 0 ? (
            <section className="card profile-panel-card sessions-empty-card">
              <p className="meta home-empty-hint">No upcoming sessions. Create one when you are ready to play.</p>
              {canShowCreate ? (
                <PrimaryButton type="button" className="w-full home-btn-primary" onClick={() => setFormOpen(true)}>
                  Create Session
                </PrimaryButton>
              ) : null}
            </section>
          ) : null}
          <ul className="list-plain sessions-list">
            {upcoming.map((session) => (
              <li key={session.id}>
                <SessionCard session={session} showLeague={!leagueName} variant="dashboard" />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <SessionsSectionHead
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 9h12v10H6z" strokeLinejoin="round" />
                <path d="M9 9V7a3 3 0 1 1 6 0v2" strokeLinecap="round" />
              </svg>
            }
          >
            Past Sessions
          </SessionsSectionHead>
          {isLoading ? (
            <section className="card profile-panel-card sessions-loading-card">
              <p className="meta">Loading sessions…</p>
            </section>
          ) : null}
          {!isLoading && past.length === 0 ? (
            <section className="card profile-panel-card sessions-empty-card">
              <p className="meta home-empty-hint">No past sessions yet. Finalize a game from Game Hub to move it here.</p>
            </section>
          ) : null}
          <ul className="list-plain sessions-list">
            {past.map((session) => {
              const rosterCount = sessionRosterCount(session)
              const maxPlayers = session.maxPlayers ?? 10
              const tone = sessionStatusTone(session.status)

              return (
                <li key={session.id}>
                  <article className="card home-session-card sessions-past-card">
                    <div className="home-dashboard-card__body">
                      <div className="home-dashboard-card__icon home-dashboard-card__icon--pitch" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="4" y="5" width="16" height="14" rx="2" />
                          <path d="M12 5v14M4 12h16" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="home-dashboard-card__content">
                        <div className="home-session-card__title-row">
                          <p className="home-dashboard-card__title">{session.title}</p>
                          <StatusChip tone={tone} className="home-session-card__status">
                            Past
                          </StatusChip>
                        </div>
                        <p className="home-dashboard-card__meta">
                          <span>{session.date}</span>
                          {session.time ? (
                            <>
                              <span className="home-session-card__meta-sep" aria-hidden="true">
                                ·
                              </span>
                              <span>{session.time}</span>
                            </>
                          ) : null}
                        </p>
                        <p className="home-dashboard-card__meta home-dashboard-card__meta--accent">
                          {rosterCount} / {maxPlayers} players
                        </p>
                      </div>
                    </div>
                    <Link to={`/game-hub/${session.id}`} className="w-full sessions-past-card__link">
                      <SecondaryButton className="w-full home-btn-secondary">View Game Hub</SecondaryButton>
                    </Link>
                  </article>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <section className="card home-footer-card profile-footer-card sessions-footer-card" aria-label="Motivation">
        <span className="home-footer-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="4" y="5" width="16" height="14" rx="2.5" />
            <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" strokeLinecap="round" />
          </svg>
        </span>
        <p className="home-footer-card__text">
          Lock the date. <span className="home-footer-card__accent">Bring the squad.</span>
        </p>
      </section>
    </div>
  )
}

export default Sessions
