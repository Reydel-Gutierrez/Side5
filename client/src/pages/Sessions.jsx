import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SessionCard from '../components/SessionCard'
import SessionFormModal from '../components/SessionFormModal'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

const sessionTabs = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function isObviousTestLeagueName(name) {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return false
  if (n === 'monday test' || n === 'monday test league') return true
  if (/\btest\s+league\b/i.test(String(name || ''))) return true
  return false
}

/** One league per player: prefer active league if in list, else first real (non-test) row, else first row. */
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
  const [leagues, setLeagues] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const sessionsResult = await apiFetch('/api/sessions')
      const allSessionRows = Array.isArray(sessionsResult?.data) ? sessionsResult.data : []

      let myLeagues = []
      let primaryLeagueId = null
      try {
        const rawUser = window.localStorage.getItem('currentUser')
        const u = rawUser ? JSON.parse(rawUser) : null
        const uid = Number.parseInt(String(u?.id ?? ''), 10)
        if (!Number.isNaN(uid) && String(uid) === String(u?.id ?? '')) {
          const mine = await apiFetch(`/api/leagues/mine?userId=${uid}`)
          const rows = Array.isArray(mine?.data) ? mine.data : []
          const picked = pickSingleLeagueRow(rows, activeLeague?.id)
          if (picked) {
            primaryLeagueId = picked.id
            myLeagues = [
              {
                id: picked.id,
                name: picked.name ?? '',
                myRole: String(picked.my_role ?? picked.myRole ?? '').toLowerCase(),
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

      const formattedSessions = sessionRows.map((session) => ({
        ...session,
        leagueId: session.league_id,
        leagueName: session.league_name,
        date: session.session_date,
        time: session.session_time,
      }))
      setSessions(formattedSessions)
      setLeagues(myLeagues)
    } catch {
      setSessions([])
      setLeagues([])
    } finally {
      setIsLoading(false)
    }
  }, [activeLeague?.id])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true)
      setSearchParams({}, { replace: true })
    }
    ;(async () => {
      await refreshLeaguesFromApi?.()
      await loadData()
    })()
  }, [searchParams, setSearchParams, loadData, refreshLeaguesFromApi])

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

  const upcoming = sessions.filter((session) => session.status !== 'completed')
  const past = sessions.filter((session) => session.status === 'completed')

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

  return (
    <div className="screen">
      <PageHeader
        title="Sessions"
        rightContent={
          <PrimaryButton
            type="button"
            className="header-cta"
            disabled={!canShowCreate}
            title={canShowCreate ? '' : 'You need owner or manager access in at least one league'}
            onClick={() => setFormOpen(true)}
          >
            Create
          </PrimaryButton>
        }
      />

      {leagues[0]?.name ? (
        <p className="meta session-league-line sessions-screen-league">League: {leagues[0].name}</p>
      ) : !isLoading ? (
        <p className="meta sessions-screen-league">Join a league from Home to see sessions here.</p>
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

      <Tabs tabs={sessionTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'upcoming' ? (
        <div className="screen-stack">
          {isLoading ? <p className="meta">Loading...</p> : null}
          {!isLoading && upcoming.length === 0 ? <p className="meta">No upcoming sessions found.</p> : null}
          {upcoming.map((session) => (
            <SessionCard key={session.id} session={session} showLeague={false} />
          ))}
        </div>
      ) : (
        <section className="card">
          <ul className="list-plain">
            {!isLoading && past.length === 0 ? <li className="list-row">No past sessions found.</li> : null}
            {past.map((session) => (
              <li key={session.id} className="list-row">
                <div>
                  <p className="session-title">{session.title}</p>
                  <p className="meta">
                    {session.date} ? {session.time}
                  </p>
                </div>
                <span className="meta">Completed</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default Sessions
