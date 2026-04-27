import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import StatStepper from '../components/StatStepper'
import { useMockApp } from '../context/MockAppContext'

function SubmitStats() {
  const { matchId } = useParams()
  const { matches, sessionTeams, sessions, submitStats, currentUser } = useMockApp()
  const [goals, setGoals] = useState(0)
  const [assists, setAssists] = useState(0)
  const [saves, setSaves] = useState(0)
  const [mvp, setMvp] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const match = matches.find((item) => item.id === matchId)
  if (!match) return <Navigate to="/" replace />

  if (!currentUser?.playerId) {
    return <Navigate to="/login" replace />
  }

  const session = sessions.find((item) => item.id === match.sessionId)
  const teams = sessionTeams[session?.id] ?? []
  const myPlayerId = currentUser.playerId
  const myTeam =
    teams.find((t) => Array.isArray(t.playerIds) && t.playerIds.includes(myPlayerId)) ?? teams[0]

  const handleSubmit = () => {
    setError('')
    const result = submitStats({
      matchId,
      playerId: myPlayerId,
      teamId: myTeam?.id ?? 'ta',
      goals,
      assists,
      saves,
      mvp,
      notes,
    })
    if (!result.ok) {
      setError(result.reason)
      return
    }
    setSubmitted(true)
  }

  const note = useMemo(
    () => 'Stats will be reviewed by a league manager or a team captain.',
    [],
  )

  const subtitle = session?.leagueName
    ? `${session.leagueName} ù ${match.date} ù ${match.time}`
    : `${match.date} ù ${match.time}`

  return (
    <div className="screen">
      <PageHeader title="Submit Your Stats" subtitle={subtitle} />
      <p className="meta">{note}</p>

      <section className="card">
        <StatStepper label="Goals" value={goals} onChange={setGoals} />
        <StatStepper label="Assists" value={assists} onChange={setAssists} />
        <StatStepper label="Saves" value={saves} onChange={setSaves} />

        <label className="toggle-row" htmlFor="mvp-toggle">
          MVP
          <input id="mvp-toggle" type="checkbox" checked={mvp} onChange={(event) => setMvp(event.target.checked)} />
        </label>

        <label className="text-area-label" htmlFor="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          className="text-area"
          value={notes}
          placeholder="Great game!"
          onChange={(event) => setNotes(event.target.value)}
        />
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <PrimaryButton className="w-full" onClick={handleSubmit}>
        Submit Stats
      </PrimaryButton>

      {submitted ? <p className="meta">Submitted as pending review.</p> : null}
    </div>
  )
}

export default SubmitStats
