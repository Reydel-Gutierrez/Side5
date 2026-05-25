import { useEffect, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import { PLAY_STYLE_OPTIONS } from '../constants/playStyles'

const DEFAULT_RATING_OPTIONS = [
  { label: 'Trash', value: 4 },
  { label: 'Bad', value: 5 },
  { label: 'Mid', value: 6.5 },
  { label: 'Good', value: 8 },
  { label: 'Beast', value: 10 },
]

const MAX_STYLES = 3

function targetLabel(assignment) {
  return assignment?.target_display_name || assignment?.target_username || 'Player'
}

export default function GameHubReviewModal({
  open,
  assignment,
  busy,
  readOnly = false,
  ratingOptions = DEFAULT_RATING_OPTIONS,
  playStyleOptions = PLAY_STYLE_OPTIONS,
  onClose,
  onSubmitReview,
}) {
  const [declineNote, setDeclineNote] = useState('')
  const [selectedRating, setSelectedRating] = useState(null)
  const [selectedStyles, setSelectedStyles] = useState([])

  useEffect(() => {
    if (!open) return
    setDeclineNote('')
    setSelectedRating(null)
    const existing = Array.isArray(assignment?.style_selections)
      ? assignment.style_selections.map((s) => s.key)
      : []
    setSelectedStyles(existing)
  }, [open, assignment?.submission_id, assignment?.review_id])

  if (!open || !assignment) return null

  const styleCount = selectedStyles.length
  const atStyleLimit = styleCount >= MAX_STYLES

  const toggleStyle = (key) => {
    setSelectedStyles((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key)
      if (prev.length >= MAX_STYLES) return prev
      return [...prev, key]
    })
  }

  const handleAccept = () => {
    if (!selectedRating || selectedStyles.length < 1) return
    onSubmitReview?.(assignment, 'accepted', undefined, selectedRating, selectedStyles)
  }

  const handleDecline = () => {
    if (!declineNote.trim()) return
    onSubmitReview?.(assignment, 'declined', declineNote.trim())
  }

  const reviewed = String(assignment.review_decision || 'pending') !== 'pending'
  const savedStyles = Array.isArray(assignment.style_selections) ? assignment.style_selections : []

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card game-hub-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-hub-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="game-hub-review-title" className="page-title">
            {readOnly ? 'Stats for' : 'Review'} {targetLabel(assignment)}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="meta">
          {assignment.goals} goal{Number(assignment.goals) === 1 ? '' : 's'} ·{' '}
          {assignment.result === 'win' ? 'Win' : 'Loss'}
        </p>
        {assignment.note ? <p className="meta">Note: {assignment.note}</p> : null}

        {readOnly || reviewed ? (
          <>
            {reviewed ? (
              <p className="meta">
                Your decision: {assignment.review_decision}
                {assignment.rating_label
                  ? ` · ${assignment.rating_label} (${assignment.rating_value})`
                  : ''}
              </p>
            ) : null}
            {savedStyles.length ? (
              <p className="meta">
                Play styles: {savedStyles.map((s) => s.label || s.key).join(', ')}
              </p>
            ) : null}
            <div className="modal-actions">
              <SecondaryButton type="button" className="w-full" onClick={onClose}>
                Close
              </SecondaryButton>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <span className="field-label">Performance rating (required to accept)</span>
              <div className="game-hub-rating-picks" role="group" aria-label="Performance rating">
                {ratingOptions.map((opt) => {
                  const active =
                    selectedRating?.label === opt.label && selectedRating?.value === opt.value
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      className={`game-hub-rating-pick${active ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => setSelectedRating(opt)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field">
              <div className="game-hub-style-head">
                <span className="field-label">Player style this match</span>
                <span className="game-hub-style-count" aria-live="polite">
                  {styleCount}/{MAX_STYLES} selected
                </span>
              </div>
              <p className="meta game-hub-style-hint">Pick 1–3 styles (required when accepting).</p>
              <div className="game-hub-style-picks" role="group" aria-label="Play styles">
                {playStyleOptions.map((opt) => {
                  const active = selectedStyles.includes(opt.key)
                  const disabled = busy || (!active && atStyleLimit)
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`game-hub-style-pick${active ? ' is-active' : ''}`}
                      disabled={disabled}
                      aria-pressed={active}
                      onClick={() => toggleStyle(opt.key)}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="game-hub-review-decline-note">
                Decline note (required if declining)
              </label>
              <input
                id="game-hub-review-decline-note"
                className="field-input"
                type="text"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="modal-actions button-row">
              <PrimaryButton
                type="button"
                className="w-full"
                disabled={busy || !selectedRating || selectedStyles.length < 1}
                onClick={handleAccept}
              >
                Accept with rating
              </PrimaryButton>
              <SecondaryButton
                type="button"
                className="w-full"
                disabled={busy || !declineNote.trim()}
                onClick={handleDecline}
              >
                Decline
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
