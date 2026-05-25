import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import GameHubReviewAllModal from '../components/GameHubReviewAllModal'
import GameHubReviewModal from '../components/GameHubReviewModal'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

function displayName(row) {
  return row?.display_name || row?.username || 'Player'
}

function targetLabel(assignment) {
  return assignment?.target_display_name || assignment?.target_username || 'Player'
}

function submissionStatusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'confirmed'
  if (s === 'declined') return 'orange'
  return 'invited'
}

function submissionStatusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'approved') return 'Approved'
  if (s === 'declined') return 'Declined'
  if (s === 'pending') return 'Pending review'
  return s || '—'
}

function sessionEyebrow(session) {
  if (!session?.session_date) return 'Match day'
  const d = new Date(session.session_date)
  if (Number.isNaN(d.getTime())) return 'Match day'
  return d.toLocaleDateString(undefined, { weekday: 'long' })
}

function totalPlayers(teams) {
  return (teams || []).reduce((sum, team) => sum + (team.players?.length || 0), 0)
}

function confirmationProgress(submission) {
  const reviews = Array.isArray(submission?.reviews) ? submission.reviews : []
  const accepted = reviews.filter((r) => String(r.decision) === 'accepted').length
  return { accepted, required: 2 }
}

function yourStatusCopy(mySubmission, statsFinalized) {
  if (statsFinalized) {
    return { label: 'Finalized', detail: 'League stats updated', accent: false }
  }
  if (!mySubmission) {
    return { label: 'Not submitted', detail: 'Submit your stats', accent: true }
  }
  const status = String(mySubmission.status || '').toLowerCase()
  if (status === 'approved') {
    return { label: 'Approved', detail: 'Awaiting manager push', accent: true }
  }
  if (status === 'declined') return { label: 'Declined', detail: 'Resubmit required', accent: true }
  return { label: 'Pending review', detail: 'Awaiting teammates', accent: true }
}

function flattenSessionPlayers(teams) {
  const seen = new Set()
  const list = []
  for (const team of teams || []) {
    for (const player of team.players || []) {
      const id = Number(player.user_id)
      if (!id || seen.has(id)) continue
      seen.add(id)
      list.push(player)
    }
  }
  return list.sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

function GameHubIcon({ name }) {
  if (name === 'lock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 20a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'chart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V9M12 19V5M19 19v-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'review') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  if (name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'session') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'trophy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 6h8v3a4 4 0 0 1-8 0V6Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 6H4v1a2 2 0 0 0 2 2M18 6h2v1a2 2 0 0 1-2 2M12 13v3M9 20h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.8 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function GameHubLoading() {
  return (
    <div className="screen game-hub-page">
      <div className="game-hub-hero game-hub-hero--loading">
        <div className="game-hub-skeleton game-hub-skeleton--eyebrow" />
        <div className="game-hub-skeleton game-hub-skeleton--title" />
        <div className="game-hub-skeleton game-hub-skeleton--meta" />
      </div>
      <div className="game-hub-status-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className="game-hub-status-card game-hub-status-card--loading" />
        ))}
      </div>
      <section className="card game-hub-roster game-hub-roster--loading">
        <div className="game-hub-skeleton game-hub-skeleton--line" />
        <div className="game-hub-skeleton game-hub-skeleton--line" />
      </section>
      <p className="meta game-hub-loading-note">Loading match hub…</p>
    </div>
  )
}

function GameHub() {
  const { sessionId } = useParams()
  const { currentUserId } = useMockApp()
  const numericSessionId = Number.parseInt(String(sessionId), 10)
  const actorId = Number.parseInt(String(currentUserId ?? ''), 10)

  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTeamId, setActiveTeamId] = useState(null)
  const [activeReview, setActiveReview] = useState(null)
  const [reviewModalMode, setReviewModalMode] = useState('review')

  const [goals, setGoals] = useState(0)
  const [result, setResult] = useState('win')
  const [note, setNote] = useState('')
  const [submitExpanded, setSubmitExpanded] = useState(true)
  const [mvpPick, setMvpPick] = useState('')
  const [reviewAllOpen, setReviewAllOpen] = useState(false)
  const [reviewAllData, setReviewAllData] = useState(null)
  const [finalizeSuccess, setFinalizeSuccess] = useState('')

  const loadHub = useCallback(async () => {
    if (Number.isNaN(numericSessionId)) return
    const qs = Number.isNaN(actorId) ? '' : `?userId=${actorId}`
    const res = await apiFetch(`/api/sessions/${numericSessionId}/game-hub${qs}`, { cache: 'no-store' })
    const data = res?.data || null
    setHub(data)
    if (data?.mySubmission) {
      setGoals(Number(data.mySubmission.goals) || 0)
      setResult(data.mySubmission.result === 'loss' ? 'loss' : 'win')
      setNote(data.mySubmission.note || '')
    }
    if (data?.teams?.length) {
      setActiveTeamId((prev) => prev || String(data.teams[0].id))
    }
  }, [numericSessionId, actorId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (Number.isNaN(numericSessionId)) return
      setLoading(true)
      setError('')
      try {
        await loadHub()
      } catch (err) {
        if (mounted) setError(err?.message || 'Could not load Game Hub')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [numericSessionId, loadHub])

  useEffect(() => {
    const interval = setInterval(() => {
      loadHub().catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [loadHub])

  const teams = hub?.teams ?? []
  const activeTeam = teams.find((t) => String(t.id) === String(activeTeamId)) ?? teams[0]

  const statsFinalized = Boolean(hub?.stats_finalized)
  const canManage = Boolean(hub?.can_manage)
  const ratingOptions = Array.isArray(hub?.ratingOptions) ? hub.ratingOptions : []

  const mySubmission = hub?.mySubmission
  const canEditSubmission =
    hub?.canSubmit &&
    !statsFinalized &&
    (!mySubmission || mySubmission.status === 'declined')
  const showSubmitForm = canEditSubmission

  const sessionPlayers = useMemo(() => flattenSessionPlayers(teams), [teams])
  const mvpVote = hub?.mvpVote
  const mvpHasVoted = Boolean(mvpVote?.hasVoted)
  const mvpEligiblePlayers = useMemo(() => sessionPlayers, [sessionPlayers])

  const reviewAssignments = Array.isArray(hub?.reviewAssignments) ? hub.reviewAssignments : []

  const pendingReviews = useMemo(
    () => reviewAssignments.filter((a) => a.can_review).length,
    [reviewAssignments],
  )

  const playerCount = useMemo(() => totalPlayers(teams), [teams])
  const yourStatus = useMemo(
    () => yourStatusCopy(mySubmission, statsFinalized),
    [mySubmission, statsFinalized],
  )
  const confirmations = useMemo(() => confirmationProgress(mySubmission), [mySubmission])

  const sessionPendingReviews = Number(hub?.verification?.pendingReviewsCount) || 0
  const verificationIsLive = statsFinalized
    ? false
    : hub?.verification
      ? hub.verification.phase === 'live'
      : sessionPendingReviews > 0 || pendingReviews > 0

  const handleSubmitStats = async () => {
    if (Number.isNaN(actorId)) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/sessions/${numericSessionId}/stat-submissions`, {
        method: 'POST',
        body: JSON.stringify({
          userId: actorId,
          goals: Math.max(0, Number.parseInt(String(goals), 10) || 0),
          result,
          note: note.trim() || undefined,
        }),
      })
      await loadHub()
      setSubmitExpanded(false)
    } catch (err) {
      setError(err?.message || 'Could not submit stats')
    } finally {
      setBusy(false)
    }
  }

  const handleReview = async (assignment, decision, declineNote, rating, styleKeys) => {
    if (Number.isNaN(actorId) || !assignment?.submission_id) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/stat-submissions/${assignment.submission_id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          reviewerUserId: actorId,
          decision,
          decline_note: decision === 'declined' ? declineNote : undefined,
          rating_label: decision === 'accepted' ? rating?.label : undefined,
          rating_value: decision === 'accepted' ? rating?.value : undefined,
          style_selections: decision === 'accepted' ? styleKeys : [],
        }),
      })
      setActiveReview(null)
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not submit review')
    } finally {
      setBusy(false)
    }
  }

  const handleMvpVote = async () => {
    if (Number.isNaN(actorId) || !mvpPick) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/sessions/${numericSessionId}/mvp-vote`, {
        method: 'POST',
        body: JSON.stringify({
          userId: actorId,
          voted_user_id: Number(mvpPick),
        }),
      })
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not submit MVP vote')
    } finally {
      setBusy(false)
    }
  }

  const openReviewAll = async () => {
    if (!canManage) return
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(
        `/api/sessions/${numericSessionId}/review-all?userId=${actorId}`,
        { cache: 'no-store' },
      )
      setReviewAllData(res?.data || null)
      setReviewAllOpen(true)
    } catch (err) {
      setError(err?.message || 'Could not load review data')
    } finally {
      setBusy(false)
    }
  }

  const refreshReviewAll = async () => {
    const res = await apiFetch(
      `/api/sessions/${numericSessionId}/review-all?userId=${actorId}`,
      { cache: 'no-store' },
    )
    setReviewAllData(res?.data || null)
  }

  const handleSaveReviewAll = async ({ players }) => {
    if (Number.isNaN(actorId)) return
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/sessions/${numericSessionId}/review-all/save`, {
        method: 'POST',
        body: JSON.stringify({ userId: actorId, players }),
      })
      await refreshReviewAll()
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not save review data')
    } finally {
      setBusy(false)
    }
  }

  const handleFinalize = async ({ players, mvp_winner_user_id: mvpWinner }) => {
    if (Number.isNaN(actorId)) return
    setBusy(true)
    setError('')
    setFinalizeSuccess('')
    try {
      const res = await apiFetch(`/api/sessions/${numericSessionId}/finalize-stats`, {
        method: 'POST',
        body: JSON.stringify({
          userId: actorId,
          players,
          mvp_winner_user_id: mvpWinner,
        }),
      })
      setReviewAllOpen(false)
      setReviewAllData(null)
      setFinalizeSuccess(
        res?.message || 'Session finalized. This game has been moved to Past Sessions.',
      )
      await loadHub()
    } catch (err) {
      setError(err?.message || 'Could not finalize stats')
    } finally {
      setBusy(false)
    }
  }

  const openReviewModal = (assignment, mode = 'review') => {
    if (mode === 'review' && !assignment?.can_review) return
    setReviewModalMode(mode)
    setActiveReview(assignment)
  }

  if (Number.isNaN(numericSessionId)) {
    return <Navigate to="/sessions" replace />
  }

  if (loading) {
    return <GameHubLoading />
  }

  if (!hub?.session) {
    return (
      <div className="screen game-hub-page">
        <section className="card game-hub-empty">
          <h1 className="page-title">Game Hub</h1>
          <p className="meta">{error || 'Session not found.'}</p>
          <Link to="/sessions">
            <PrimaryButton className="w-full">Back to sessions</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  if (!hub.allTeamsLocked && !statsFinalized) {
    return (
      <div className="screen game-hub-page">
        <section className="card game-hub-empty center-card">
          <div className="game-hub-status-icon" aria-hidden="true">
            <GameHubIcon name="lock" />
          </div>
          <h1 className="page-title">{hub.session.title}</h1>
          <p className="meta">All teams must be locked before Game Hub opens.</p>
          <Link to={`/draft/${hub.session.id}`}>
            <PrimaryButton className="w-full">Back to draft</PrimaryButton>
          </Link>
        </section>
      </div>
    )
  }

  const rosterPlayers = activeTeam?.players || []
  const half = Math.ceil(rosterPlayers.length / 2)
  const rosterColumns = [rosterPlayers.slice(0, half), rosterPlayers.slice(half)]

  return (
    <div className="screen game-hub-page">
      <header className="game-hub-hero">
        <div className="game-hub-hero__bg" aria-hidden="true">
          <span className="game-hub-hero__ball" />
        </div>
        <div className="game-hub-hero__content">
          <div className="game-hub-hero__top">
            <p className="game-hub-hero__eyebrow">{sessionEyebrow(hub.session)}</p>
            {statsFinalized ? (
              <span className="game-hub-finalized-chip">Past · Finalized</span>
            ) : verificationIsLive ? (
              <span className="game-hub-live-chip">
                <span className="game-hub-live-chip__dot" />
                Live
              </span>
            ) : (
              <span className="game-hub-concluded-chip">Concluded</span>
            )}
          </div>
          <h1 className="game-hub-hero__title">Game Hub</h1>
          <p className="game-hub-hero__session">{hub.session.title}</p>
          {hub.league?.name ? <p className="game-hub-hero__league">{hub.league.name}</p> : null}
          <p className="game-hub-hero__hint">
            {statsFinalized
              ? 'League stats have been pushed'
              : verificationIsLive
                ? 'Stats verification is open'
                : 'All teammate reviews are complete'}
          </p>
          <div className="game-hub-hero__actions">
            {canManage ? (
              <button
                type="button"
                className="game-hub-review-all-btn"
                disabled={busy}
                onClick={openReviewAll}
                title={
                  statsFinalized
                    ? 'View finalized session stats (read-only)'
                    : 'Review and push final session stats'
                }
              >
                {statsFinalized ? 'View final stats' : 'Review All'}
              </button>
            ) : null}
            {statsFinalized ? (
              <Link to="/sessions?tab=past" className="game-hub-review-all-btn game-hub-past-link">
                Past Sessions
              </Link>
            ) : null}
          </div>
          <div className="game-hub-hero__meta">
            <span>
              <GameHubIcon name="lock" /> Locked
            </span>
            <span>
              <GameHubIcon name="users" /> {teams.length} teams
            </span>
            <span>
              <GameHubIcon name="user" /> {playerCount} players
            </span>
          </div>
        </div>
      </header>

      <div className="game-hub-status-row">
        <article className="game-hub-status-card">
          <span className="game-hub-status-card__icon">
            <GameHubIcon name="lock" />
          </span>
          <div>
            <p className="game-hub-status-card__label">Teams locked</p>
            <p className="game-hub-status-card__detail">Ready to go</p>
          </div>
        </article>
        <article className="game-hub-status-card">
          <span className="game-hub-status-card__icon">
            <GameHubIcon name="review" />
          </span>
          <div>
            <p className="game-hub-status-card__label">Reviews</p>
            <p className="game-hub-status-card__detail">
              {pendingReviews > 0 ? `${pendingReviews} pending` : 'All caught up'}
            </p>
          </div>
        </article>
        <article className={`game-hub-status-card${yourStatus.accent ? ' is-accent' : ''}`}>
          <span className="game-hub-status-card__icon">
            <GameHubIcon name="user" />
          </span>
          <div>
            <p className="game-hub-status-card__label">You</p>
            <p className="game-hub-status-card__detail">{yourStatus.label}</p>
          </div>
        </article>
      </div>

      {teams.length > 0 ? (
        <div className="game-hub-team-tabs" role="tablist" aria-label="Teams">
          {teams.map((team) => {
            const count = team.players?.length || 0
            const isActive = String(team.id) === String(activeTeam?.id)
            return (
              <button
                key={team.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`game-hub-team-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveTeamId(String(team.id))}
              >
                <span className="game-hub-team-tab__dot" aria-hidden="true" />
                {team.name || 'Team'} · {count}
              </button>
            )
          })}
        </div>
      ) : null}

      {activeTeam ? (
        <section className="card game-hub-roster">
          <div className="game-hub-roster__head">
            <div>
              <p className="game-hub-roster__label">Team roster</p>
              <h2 className="game-hub-roster__title">{activeTeam.name}</h2>
            </div>
            <p className="game-hub-roster__budget">
              Budget used <strong>${Number(activeTeam.budget_used || 0).toFixed(1)}M</strong>
            </p>
          </div>
          <div className="game-hub-roster__grid">
            {rosterColumns.map((column, colIndex) => (
              <ul key={colIndex} className="game-hub-roster__col">
                {column.map((player) => (
                  <li key={`${activeTeam.id}-${player.user_id}`} className="game-hub-roster__player">
                    <span className="game-hub-roster__name">
                      {displayName(player)}
                      {player.is_captain ? (
                        <span className="game-hub-captain-chip">Captain</span>
                      ) : null}
                    </span>
                    <span className="game-hub-roster__worth">
                      ${Number(player.player_worth || 0).toFixed(1)}M
                    </span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      ) : null}

      {finalizeSuccess ? (
        <section className="card game-hub-finalize-banner" role="status">
          <p className="meta">{finalizeSuccess}</p>
          <Link to="/sessions?tab=past">
            <SecondaryButton type="button" className="w-full">
              View Past Sessions
            </SecondaryButton>
          </Link>
        </section>
      ) : null}

      <section
        className={`card game-hub-submit${showSubmitForm || mySubmission ? ' is-primary' : ''}${statsFinalized ? ' is-readonly' : ''}`}
      >
        <button
          type="button"
          className="game-hub-submit__head"
          onClick={() => {
            if (!statsFinalized) setSubmitExpanded((v) => !v)
          }}
          aria-expanded={submitExpanded}
          disabled={statsFinalized}
        >
          <span className="game-hub-submit__icon">
            <GameHubIcon name="chart" />
          </span>
          <span className="game-hub-submit__copy">
            <span className="game-hub-submit__title">Submit My Stats</span>
            <span className="game-hub-submit__subtitle">Your match. Your stats.</span>
          </span>
          <span className="game-hub-submit__chevron" aria-hidden="true">
            ›
          </span>
        </button>

        <div className="game-hub-submit__status-row">
          {mySubmission ? (
            <StatusChip tone={submissionStatusTone(mySubmission.status)}>
              {submissionStatusLabel(mySubmission.status)}
            </StatusChip>
          ) : (
            <StatusChip tone="invited">Not submitted</StatusChip>
          )}
          {mySubmission?.status === 'pending' ? (
            <span className="game-hub-submit__confirmations">
              {confirmations.accepted} / {confirmations.required} confirmations
            </span>
          ) : null}
        </div>

        {submitExpanded ? (
          <div className="game-hub-submit__body">
            {!hub.canSubmit ? (
              <p className="meta">You need to be on a team in this session to submit stats.</p>
            ) : null}

            {mySubmission?.status === 'declined' && mySubmission.decline_note ? (
              <p className="meta game-hub-decline-note">
                Declined: {mySubmission.decline_note}
              </p>
            ) : null}

            {mySubmission?.status === 'approved' ? (
              <p className="meta">
                {statsFinalized
                  ? `Finalized — ${mySubmission.goals} goal${mySubmission.goals === 1 ? '' : 's'}, ${mySubmission.result === 'win' ? 'win' : 'loss'}${mySubmission.approved_rating != null ? `, rating ${mySubmission.approved_rating}` : ''}.`
                  : `Approved by teammates${mySubmission.approved_rating != null ? ` (avg rating ${mySubmission.approved_rating})` : ''} — awaiting manager push.`}
              </p>
            ) : null}

            {mySubmission?.status === 'pending' ? (
              <p className="meta">Waiting for two teammates to confirm your submission.</p>
            ) : null}

            {showSubmitForm ? (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="game-hub-goals">
                    Goals
                  </label>
                  <input
                    id="game-hub-goals"
                    className="field-input"
                    type="number"
                    min={0}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="field">
                  <span className="field-label">Result</span>
                  <div className="button-row game-hub-result-row">
                    <SecondaryButton
                      type="button"
                      className={result === 'win' ? 'game-hub-result-btn is-active' : 'game-hub-result-btn'}
                      disabled={busy}
                      onClick={() => setResult('win')}
                    >
                      Win
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      className={result === 'loss' ? 'game-hub-result-btn is-active' : 'game-hub-result-btn'}
                      disabled={busy}
                      onClick={() => setResult('loss')}
                    >
                      Loss
                    </SecondaryButton>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="game-hub-note">
                    Note (optional)
                  </label>
                  <textarea
                    id="game-hub-note"
                    className="field-input"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                    placeholder="Quick note for reviewers"
                  />
                </div>
                <PrimaryButton
                  type="button"
                  className="w-full"
                  disabled={busy || !hub.canSubmit}
                  onClick={handleSubmitStats}
                >
                  {mySubmission?.status === 'declined' ? 'Resubmit stats' : 'Submit stats'}
                </PrimaryButton>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {sessionPlayers.length > 0 ? (
        <section className="card game-hub-mvp">
          <div className="game-hub-mvp__head">
            <span className="game-hub-submit__icon">
              <GameHubIcon name="trophy" />
            </span>
            <div>
              <h2 className="game-hub-mvp__title">MVP Vote</h2>
              <p className="game-hub-mvp__subtitle">One vote per player for this session</p>
            </div>
          </div>
          {statsFinalized && hub.mvp_winner ? (
            <p className="meta game-hub-mvp-winner">
              MVP:{' '}
              {hub.mvp_winner.display_name || hub.mvp_winner.username || 'Player'}
            </p>
          ) : null}
          {statsFinalized ? (
            <p className="meta">Voting closed — session stats are finalized.</p>
          ) : mvpHasVoted ? (
            <p className="meta">
              You voted for{' '}
              {displayName(
                sessionPlayers.find(
                  (p) => Number(p.user_id) === Number(mvpVote?.myVote?.voted_user_id),
                ),
              ) || 'a teammate'}
              .
            </p>
          ) : hub?.canSubmit ? (
            <>
              <div className="field">
                <label className="field-label" htmlFor="game-hub-mvp-pick">
                  Pick MVP
                </label>
                <select
                  id="game-hub-mvp-pick"
                  className="field-input"
                  value={mvpPick}
                  disabled={busy}
                  onChange={(e) => setMvpPick(e.target.value)}
                >
                  <option value="">Select player…</option>
                  {mvpEligiblePlayers.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </div>
              <PrimaryButton
                type="button"
                className="w-full"
                disabled={busy || !mvpPick}
                onClick={handleMvpVote}
              >
                Submit MVP vote
              </PrimaryButton>
            </>
          ) : (
            <p className="meta">Join a team in this session to vote for MVP.</p>
          )}
          {Array.isArray(mvpVote?.totals) && mvpVote.totals.length > 0 ? (
            <ul className="game-hub-mvp-totals">
              {mvpVote.totals.map((t) => (
                <li key={t.user_id}>
                  {displayName(t)} — {t.vote_count} vote{t.vote_count === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {reviewAssignments.length > 0 ? (
        <section className="game-hub-reviews">
          <div className="game-hub-reviews__head">
            <h2 className="game-hub-reviews__title">Review teammates</h2>
            {pendingReviews > 0 ? (
              <span className="game-hub-reviews__count">{pendingReviews} pending</span>
            ) : null}
          </div>
          <ul className="game-hub-review-list">
            {reviewAssignments.map((assignment) => {
              const name = targetLabel(assignment)
              const waiting = !assignment.target_has_submitted
              const reviewed = String(assignment.review_decision || 'pending') !== 'pending'
              const accepted = String(assignment.review_decision || '') === 'accepted'
              if (reviewed && !assignment.can_review) {
                return (
                  <li key={assignment.slot_id} className="game-hub-review-row is-done">
                    <span className="game-hub-review-row__check" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      {accepted ? `Reviewed ${name}` : `Declined ${name}`}
                    </span>
                  </li>
                )
              }

              return (
                <li key={assignment.slot_id} className="game-hub-review-row">
                  <div className="game-hub-review-row__avatar" aria-hidden="true">
                    <GameHubIcon name="user" />
                  </div>
                  <div className="game-hub-review-row__info">
                    <p className="game-hub-review-row__name">{name}</p>
                    <p className={`game-hub-review-row__stats${waiting ? ' is-muted' : ''}`}>
                      {waiting ? (
                        `Waiting for ${name} to submit stats`
                      ) : (
                        <>
                          {Number(assignment.goals) || 0} Goal
                          {(Number(assignment.goals) || 0) === 1 ? '' : 's'} ·{' '}
                          <span
                            className={
                              assignment.result === 'loss' ? 'is-loss' : 'is-win'
                            }
                          >
                            {assignment.result === 'loss' ? 'Loss' : 'Win'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="game-hub-review-row__actions">
                    <SecondaryButton
                      type="button"
                      className="game-hub-btn-compact"
                      disabled={waiting || !assignment.submission_id}
                      onClick={() => openReviewModal(assignment, 'view')}
                    >
                      View
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      className="game-hub-btn-compact"
                      disabled={busy || statsFinalized || !assignment.can_review}
                      onClick={() => openReviewModal(assignment, 'review')}
                    >
                      Review
                    </PrimaryButton>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {error ? <p className="meta game-hub-error">{error}</p> : null}

      <div className="game-hub-nav-row">
        <Link to="/sessions" className="game-hub-nav-card">
          <span className="game-hub-nav-card__icon">
            <GameHubIcon name="session" />
          </span>
          <span className="game-hub-nav-card__copy">
            <span className="game-hub-nav-card__title">
              {statsFinalized ? 'All sessions' : 'Sessions'}
            </span>
            <span className="game-hub-nav-card__subtitle">
              {statsFinalized ? 'Open Past Sessions list' : 'Back to schedule'}
            </span>
          </span>
        </Link>
        <Link to="/stats" className="game-hub-nav-card">
          <span className="game-hub-nav-card__icon">
            <GameHubIcon name="trophy" />
          </span>
          <span className="game-hub-nav-card__copy">
            <span className="game-hub-nav-card__title">Leaderboard</span>
            <span className="game-hub-nav-card__subtitle">See league standings</span>
          </span>
        </Link>
      </div>

      <GameHubReviewModal
        key={`${activeReview?.review_id || 'closed'}-${reviewModalMode}`}
        open={Boolean(activeReview)}
        assignment={activeReview}
        busy={busy}
        readOnly={reviewModalMode === 'view' || statsFinalized}
        ratingOptions={ratingOptions}
        playStyleOptions={hub?.playStyleOptions}
        onClose={() => setActiveReview(null)}
        onSubmitReview={handleReview}
      />

      <GameHubReviewAllModal
        open={reviewAllOpen}
        busy={busy}
        reviewAll={reviewAllData}
        statsFinalized={statsFinalized}
        ratingOptions={ratingOptions}
        onClose={() => {
          setReviewAllOpen(false)
          setReviewAllData(null)
        }}
        onSave={handleSaveReviewAll}
        onFinalize={handleFinalize}
        onRefresh={refreshReviewAll}
      />
    </div>
  )
}

export default GameHub
