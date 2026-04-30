import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import StatStepper from '../components/StatStepper'
import { useMockApp } from '../context/MockAppContext'

const RESULT_OPTIONS = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'draw', label: 'Draw' },
]

const ATTRIBUTE_OPTIONS = [
  'Fast',
  'Intelligent',
  'Sniper',
  'Strong',
  'Skilled',
  'Creative',
  'Defensive',
  'Clutch',
  'Leader',
  'Aggressive',
  'Stamina',
  'Passer',
  'Dribbler',
  'Positioning',
]

const PERFORMANCE_OPTIONS = [
  { value: 60, label: 'Very Low' },
  { value: 68, label: 'Low' },
  { value: 75, label: 'Regular' },
  { value: 84, label: 'Good' },
  { value: 92, label: 'Very Good' },
  { value: 98, label: 'Elite' },
]

function PostMatchReport() {
  const { matchId } = useParams()
  const {
    currentUser,
    getMatchContext,
    submitStats,
    getMyStatSubmissionForMatch,
    getAssignedReviewPlayerIds,
    playerReviews,
    submitPlayerReviews,
    mvpVotes,
    submitMvpVote,
    players,
  } = useMockApp()
  const [goals, setGoals] = useState(0)
  const [result, setResult] = useState('won')
  const [reviewDraft, setReviewDraft] = useState({})
  const [mvpVotePlayerId, setMvpVotePlayerId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!currentUser) return <Navigate to="/login" replace />

  const context = getMatchContext(matchId)
  if (!context.match && !context.session) return <Navigate to="/" replace />

  const mySubmission = getMyStatSubmissionForMatch(matchId)
  const assignedPlayerIds = getAssignedReviewPlayerIds(matchId)
  const existingMyReviews = playerReviews.filter(
    (item) => item.matchId === matchId && String(item.reviewerUserId) === String(currentUser.id),
  )
  const existingVote = mvpVotes.find((item) => item.matchId === matchId && String(item.voterUserId) === String(currentUser.id))
  const participantPlayerIds = context.rosterPlayerIds

  const playerName = (playerId) => players.find((item) => item.id === playerId)?.name ?? 'Player'
  const voteValue = mvpVotePlayerId || existingVote?.mvpVotePlayerId || ''

  const assignmentCards = useMemo(() => {
    return assignedPlayerIds.map((playerId) => {
      const existing = existingMyReviews.find((item) => item.reviewedPlayerId === playerId)
      const draft = reviewDraft[playerId] ?? {}
      return {
        playerId,
        name: playerName(playerId),
        selectedAttributes: draft.selectedAttributes ?? existing?.selectedAttributes ?? [],
        performanceScore: draft.performanceScore ?? existing?.performanceScore ?? 75,
      }
    })
  }, [assignedPlayerIds, existingMyReviews, reviewDraft])

  const toggleAttribute = (playerId, attribute) => {
    setReviewDraft((prev) => {
      const current = prev[playerId] ?? {}
      const selected = current.selectedAttributes ?? []
      const hasAttribute = selected.includes(attribute)
      const nextSelected = hasAttribute
        ? selected.filter((item) => item !== attribute)
        : selected.length < 3
          ? [...selected, attribute]
          : selected
      return {
        ...prev,
        [playerId]: {
          ...current,
          selectedAttributes: nextSelected,
        },
      }
    })
  }

  const setPerformance = (playerId, score) => {
    setReviewDraft((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        performanceScore: score,
      },
    }))
  }

  const handleSubmitStats = () => {
    setError('')
    setSuccess('')
    const response = submitStats({ matchId, goals, result })
    if (!response.ok) {
      setError(response.reason)
      return
    }
    setSuccess('Stats submitted for captain approval.')
  }

  const handleSubmitReviews = () => {
    setError('')
    setSuccess('')
    const payload = assignmentCards.map((card) => ({
      reviewedPlayerId: card.playerId,
      selectedAttributes: card.selectedAttributes,
      performanceScore: card.performanceScore,
    }))
    const invalid = payload.some((item) => item.selectedAttributes.length === 0 || item.selectedAttributes.length > 3)
    if (invalid) {
      setError('Select 1-3 attributes for each assigned player.')
      return
    }
    const response = submitPlayerReviews({ matchId, reviews: payload })
    if (!response.ok) {
      setError(response.reason)
      return
    }
    setSuccess('Player reviews submitted.')
  }

  const handleVoteMvp = () => {
    setError('')
    setSuccess('')
    if (!voteValue) {
      setError('Choose one MVP player.')
      return
    }
    const response = submitMvpVote({ matchId, mvpVotePlayerId: voteValue })
    if (!response.ok) {
      setError(response.reason)
      return
    }
    setSuccess('MVP vote saved.')
  }

  return (
    <div className="screen">
      <PageHeader title="Post-Match Report" />

      {mySubmission?.status === 'denied' ? (
        <section className="card post-match-alert-card">
          <p className="session-title">Your stats were denied by captain.</p>
          <p className="meta">{mySubmission.captainComment}</p>
        </section>
      ) : null}

      <section className="card">
        <p className="session-title">Your match stats</p>
        {mySubmission?.status === 'approved' ? (
          <p className="meta">Approved. These stats now count toward your profile and leaderboard.</p>
        ) : mySubmission?.status === 'pending' ? (
          <p className="meta">Submitted and pending captain approval.</p>
        ) : (
          <p className="meta">Self stats stay pending until captain approval.</p>
        )}
        <StatStepper label="Goals scored" value={goals} onChange={setGoals} />
        <div className="post-match-pill-row">
          {RESULT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`post-match-pill ${result === option.value ? 'is-active' : ''}`.trim()}
              onClick={() => setResult(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <PrimaryButton className="w-full" disabled={mySubmission?.status === 'approved'} onClick={handleSubmitStats}>
          {mySubmission?.status === 'denied' ? 'Resubmit Stats' : 'Submit Stats'}
        </PrimaryButton>
      </section>

      <section className="card">
        <p className="session-title">Player Reviews</p>
        <p className="meta">Review 2 assigned players. We prioritize players from the opposite team.</p>
        <div className="screen-stack">
          {assignmentCards.map((card) => (
            <article key={card.playerId} className="post-match-review-card">
              <p className="session-title">{card.name}</p>
              <p className="meta">What were this player's strongest attributes this session?</p>
              <div className="post-match-pill-row">
                {ATTRIBUTE_OPTIONS.map((attribute) => (
                  <button
                    key={`${card.playerId}-${attribute}`}
                    type="button"
                    className={`post-match-pill ${card.selectedAttributes.includes(attribute) ? 'is-active' : ''}`.trim()}
                    onClick={() => toggleAttribute(card.playerId, attribute)}
                  >
                    {attribute}
                  </button>
                ))}
              </div>
              <p className="meta">How would you rate this player's performance?</p>
              <div className="post-match-pill-row">
                {PERFORMANCE_OPTIONS.map((option) => (
                  <button
                    key={`${card.playerId}-${option.value}`}
                    type="button"
                    className={`post-match-pill ${Number(card.performanceScore) === option.value ? 'is-active' : ''}`.trim()}
                    onClick={() => setPerformance(card.playerId, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        <PrimaryButton className="w-full" onClick={handleSubmitReviews}>
          Submit Reviews
        </PrimaryButton>
      </section>

      <section className="card">
        <p className="session-title">Who was MVP of the session?</p>
        <div className="post-match-vote-list">
          {participantPlayerIds.map((playerId) => (
            <label key={playerId} className="post-match-vote-row">
              <input
                type="radio"
                name="mvp-player"
                value={playerId}
                checked={voteValue === playerId}
                onChange={(event) => setMvpVotePlayerId(event.target.value)}
              />
              <span>{playerName(playerId)}</span>
            </label>
          ))}
        </div>
        <PrimaryButton className="w-full" onClick={handleVoteMvp}>
          Save MVP Vote
        </PrimaryButton>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="meta">{success}</p> : null}
    </div>
  )
}

export default PostMatchReport
