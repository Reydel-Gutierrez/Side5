import { useEffect, useMemo, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

const defaultForm = {
  leagueId: '',
  title: '',
  dateIso: '',
  time24: '20:00',
  location: '',
  format: '5v5',
  budgetPerTeam: 50,
  maxPlayers: 8,
  status: 'draft_pending',
}

function sessionToForm(session) {
  if (!session) return { ...defaultForm }
  return {
    leagueId: session.leagueId ?? '',
    title: session.title ?? '',
    dateIso: session.dateIso ?? '',
    time24: session.time24 ?? '20:00',
    location: session.location ?? '',
    format: session.format ?? '5v5',
    budgetPerTeam: session.budgetPerTeam ?? 50,
    maxPlayers: session.maxPlayers ?? session.players?.length ?? session.playerIds?.length ?? 8,
    status: session.status ?? 'draft_pending',
  }
}

function SessionFormModal({
  open,
  mode,
  session,
  maxRoster,
  getLeagueMemberPlayerCount,
  leagues,
  defaultLeagueId,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && session) {
        setForm(sessionToForm(session))
      } else {
        setForm({
          ...defaultForm,
          leagueId: defaultLeagueId || leagues?.[0]?.id || '',
        })
      }
      setError('')
    }
  }, [open, mode, session, defaultLeagueId, leagues])

  const title = useMemo(() => (mode === 'edit' ? 'Edit session' : 'Create session'), [mode])

  if (!open) return null

  const countRawOpen = getLeagueMemberPlayerCount?.(form.leagueId)
  const rosterCap = Math.max(1, countRawOpen !== undefined && countRawOpen !== null ? countRawOpen : maxRoster)
  const rosterMaxInput = Math.max(4, rosterCap)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (!form.title.trim()) {
      setError('Please enter a session name.')
      return
    }
    if (!form.dateIso) {
      setError('Please pick a date.')
      return
    }
    if (!form.time24) {
      setError('Please pick a time.')
      return
    }
    const countRaw = getLeagueMemberPlayerCount?.(form.leagueId)
    const rosterCap = Math.max(1, countRaw !== undefined && countRaw !== null ? countRaw : maxRoster)
    const maxPlayers = Math.min(Math.max(4, Number(form.maxPlayers) || 4), Math.max(4, rosterCap))
    const budget = Math.min(Math.max(10, Number(form.budgetPerTeam) || 50), 200)
    onSubmit({
      leagueId: form.leagueId || defaultLeagueId || leagues?.[0]?.id,
      title: form.title.trim(),
      dateIso: form.dateIso,
      time24: form.time24,
      location: form.location.trim() || 'TBD',
      format: form.format,
      budgetPerTeam: budget,
      maxPlayers,
      status: form.status,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="session-form-title" className="page-title">
            {title}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="meta">Set the basics now; you can edit this session anytime.</p>

        <div className="form-stack">
          {mode === 'create' && leagues?.length ? (
            <label className="field">
              <span className="field-label">League</span>
              <select
                className="field-input"
                value={form.leagueId}
                onChange={(e) => handleChange('leagueId', e.target.value)}
              >
                {leagues.map((lg) => (
                  <option key={lg.id} value={lg.id}>
                    {lg.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span className="field-label">Session name</span>
            <input
              className="field-input"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Monday Night"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">Date</span>
            <input
              className="field-input"
              type="date"
              value={form.dateIso}
              onChange={(e) => handleChange('dateIso', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Time</span>
            <input
              className="field-input"
              type="time"
              value={form.time24}
              onChange={(e) => handleChange('time24', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <input
              className="field-input"
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Downtown Court"
            />
          </label>

          <label className="field">
            <span className="field-label">Format</span>
            <select className="field-input" value={form.format} onChange={(e) => handleChange('format', e.target.value)}>
              <option value="5v5">5v5</option>
              <option value="6v6">6v6</option>
              <option value="7v7">7v7</option>
              <option value="8v8">8v8</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Budget per team ($M)</span>
            <input
              className="field-input"
              type="number"
              min={10}
              max={200}
              step={1}
              value={form.budgetPerTeam}
              onChange={(e) => handleChange('budgetPerTeam', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Expected players (roster size)</span>
            <input
              className="field-input"
              type="number"
              min={4}
              max={rosterMaxInput}
              value={form.maxPlayers}
              onChange={(e) => handleChange('maxPlayers', e.target.value)}
            />
            <span className="field-hint">
              Confirmed roster is league members only (up to {rosterCap} in this league).
            </span>
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select className="field-input" value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
              <option value="draft_pending">Draft pending</option>
              <option value="upcoming">Upcoming</option>
              <option value="locked">Locked</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="button-row modal-actions">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" onClick={handleSave}>
            {mode === 'edit' ? 'Save changes' : 'Create session'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

export default SessionFormModal
