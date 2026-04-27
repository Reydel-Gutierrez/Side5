import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CreateLeagueModal from '../components/CreateLeagueModal'
import JoinLeagueModal from '../components/JoinLeagueModal'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { useMockApp } from '../context/MockAppContext'

function Leagues() {
  const { leaguesDisplay, createLeague, joinLeague, myLeagueIds } = useMockApp()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true)
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('join') === '1') {
      setJoinOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const myLeagues = leaguesDisplay.filter((league) => myLeagueIds.includes(league.id))

  return (
    <div className="screen">
      <PageHeader title="Leagues" />

      <div className="button-row">
        <PrimaryButton type="button" className="w-full" onClick={() => setCreateOpen(true)}>
          Create League
        </PrimaryButton>
        <SecondaryButton type="button" className="w-full" onClick={() => setJoinOpen(true)}>
          Join League
        </SecondaryButton>
      </div>

      <CreateLeagueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(payload) => {
          const result = createLeague(payload)
          if (!result.ok) {
            window.alert(result.reason)
            return
          }
          setCreateOpen(false)
          navigate(`/leagues/${result.id}`)
        }}
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

      <div className="screen-stack">
        {myLeagues.length === 0 ? (
          <section className="card">
            <p className="meta">You are not in any leagues right now. Join one with an invite code.</p>
          </section>
        ) : (
          myLeagues.map((league) => (
            <article key={league.id} className="card league-list-card">
              <p className="session-title">{league.name}</p>
              <p className="meta">{league.description}</p>
              <p className="meta invite-code-line">
                Invite: <span className="invite-code">{league.inviteCode}</span>
              </p>
              <p className="meta">
                {league.memberCount} players · {league.sessionCount} sessions
              </p>
              <Link to={`/leagues/${league.id}`}>
                <SecondaryButton className="w-full">View</SecondaryButton>
              </Link>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

export default Leagues
