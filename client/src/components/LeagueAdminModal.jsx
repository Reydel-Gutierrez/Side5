import { useEffect } from 'react'
import LeagueManagementPanel from './LeagueManagementPanel'

export default function LeagueAdminModal({ open, onClose, panelProps }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card league-admin-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-admin-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="league-admin-modal-title" className="page-title">
            League administration
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="meta league-admin-modal__intro">All changes are saved to the database.</p>
        <LeagueManagementPanel {...panelProps} embeddedInModal />
      </div>
    </div>
  )
}
