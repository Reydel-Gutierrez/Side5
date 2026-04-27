import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SessionCard from '../components/SessionCard'
import SessionFormModal from '../components/SessionFormModal'
import Tabs from '../components/Tabs'
import { useMockApp } from '../context/MockAppContext'

const sessionTabs = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

function Sessions() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [formOpen, setFormOpen] = useState(false)
  const [leagueFilter, setLeagueFilter] = useState('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    sessions,
    players,
    createSession,
    leaguesDisplay,
    activeLeagueId,
    currentUser,
    canManageLeague,
    getLeagueMemberPlayerIds,
  } = useMockApp()

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const canShowCreate = Boolean(currentUser && leaguesDisplay.some((l) => canManageLeague(l.id)))

  const defaultLeagueId = useMemo(() => {
    if (activeLeagueId && canManageLeague(activeLeagueId)) return activeLeagueId
    return leaguesDisplay.find((l) => canManageLeague(l.id))?.id ?? leaguesDisplay[0]?.id
  }, [activeLeagueId, canManageLeague, leaguesDisplay])

  const filteredSessions = useMemo(() => {
    if (leagueFilter === 'all') return sessions
    return sessions.filter((s) => s.leagueId === leagueFilter)
  }, [sessions, leagueFilter])

  const upcoming = filteredSessions.filter((session) => session.status !== 'completed')
  const past = filteredSessions.filter((session) => session.status === 'completed')

  const handleCreate = (payload) => {
    const result = createSession(payload)
    if (!result.ok) {
      window.alert(result.reason)
      return
    }
    setFormOpen(false)
    navigate(`/sessions/${result.id}`)
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
            title={
              !currentUser
                ? 'Log in to create sessions'
                : 'You need owner or manager access in at least one league'
            }
            onClick={() => setFormOpen(true)}
          >
            Create
          </PrimaryButton>
        }
      />

      <label className="field league-filter-field">
        <span className="field-label">League</span>
        <select
          className="field-input"
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
        >
          <option value="all">All leagues</option>
          {leaguesDisplay.map((lg) => (
            <option key={lg.id} value={lg.id}>
              {lg.name}
            </option>
          ))}
        </select>
      </label>

      <SessionFormModal
        open={formOpen}
        mode="create"
        session={null}
        maxRoster={players.length}
        getLeagueMemberPlayerCount={(leagueId) => getLeagueMemberPlayerIds(leagueId).length}
        leagues={leaguesDisplay}
        defaultLeagueId={defaultLeagueId}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      <Tabs tabs={sessionTabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'upcoming' ? (
        <div className="screen-stack">
          {upcoming.map((session) => (
            <SessionCard key={session.id} session={session} showLeague />
          ))}
        </div>
      ) : (
        <section className="card">
          <ul className="list-plain">
            {past.map((session) => (
              <li key={session.id} className="list-row">
                <div>
                  <p className="session-title">{session.title}</p>
                  <p className="meta league-inline">League: {session.leagueName}</p>
                  <p className="meta">
                    {session.date} · {session.time}
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
