import { useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

function targetLabel(assignment) {
  return assignment?.target_display_name || assignment?.target_username || 'Player'
}

export default function GameHubReviewModal({ open, assignment, busy, onClose, onSubmitReview }) {
  const [declineNote, setDeclineNote] = useState('')

  if (!open || !assignment) return null

  const handleAccept = () => {
    onSubmitReview?.(assignment, 'accepted')
  }

  const handleDecline = () => {
    if (!declineNote.trim()) return
    onSubmitReview?.(assignment, 'declined', declineNote.trim())
  }

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
            Review {targetLabel(assignment)}
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
          <PrimaryButton type="button" className="w-full" disabled={busy} onClick={handleAccept}>
            Accept
          </PrimaryButton>
          <SecondaryButton type="button" className="w-full" disabled={busy || !declineNote.trim()} onClick={handleDecline}>
            Decline
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
