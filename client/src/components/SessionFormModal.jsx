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
  teamCount: 2,
  teamNames: ['Side A', 'Side B'],
}

function sessionToForm(session, existingTeams = null) {
  if (!session) return { ...defaultForm }
  let dateIso = session.dateIso ?? ''
  if (!dateIso && session.session_date != null) {
    const sd = session.session_date
    if (sd instanceof Date && !Number.isNaN(sd.getTime())) {
      dateIso = sd.toISOString().slice(0, 10)
    } else if (typeof sd === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sd)) {
      dateIso = sd.slice(0, 10)
    } else {
      dateIso = String(sd).slice(0, 10)
    }
  }
  let time24 = session.time24 ?? '20:00'
  if (session.session_time != null) {
    const tr = String(session.session_time)
    const short = tr.length >= 5 ? tr.slice(0, 5) : tr
    if (/^\d{2}:\d{2}$/.test(short)) time24 = short
  }
  const rosterLen = Array.isArray(session.players) ? session.players.length : 0
  let teamCount = 2
  let teamNames = ['Side A', 'Side B']
  if (Array.isArray(existingTeams) && existingTeams.length) {
    teamCount = Math.min(8, Math.max(2, existingTeams.length))
    teamNames = existingTeams.slice(0, teamCount).map((t, idx) => {
      const n = String(t?.name ?? '')
        .trim()
        .slice(0, 50)
      return n || `Team ${idx + 1}`
    })
    while (teamNames.length < teamCount) teamNames.push(`Team ${teamNames.length + 1}`)
  }
  return {
    leagueId: String(session.leagueId ?? session.league_id ?? ''),
    title: session.title ?? '',
    dateIso,
    time24,
    location: session.location ?? '',
    format: session.format ?? '5v5',
    budgetPerTeam: Number(session.budgetPerTeam ?? session.budget_per_team) || 50,
    maxPlayers: session.maxPlayers ?? session.playerIds?.length ?? (rosterLen > 0 ? rosterLen : 8),
    status: session.status ?? 'draft_pending',
    teamCount,
    teamNames,
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
  existingTeams,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && session) {
        setForm(sessionToForm(session, existingTeams))
      } else {
        setForm({
          ...defaultForm,
          leagueId: defaultLeagueId || leagues?.[0]?.id || '',
        })
      }
      setError('')
    }
  }, [open, mode, session, defaultLeagueId, leagues, existingTeams])

  const title = useMemo(() => (mode === 'edit' ? 'Edit session' : 'Create session'), [mode])

  const resolvedLeagueId =
    mode === 'create'
      ? String(defaultLeagueId || leagues?.[0]?.id || form.leagueId || '')
      : String(form.leagueId || defaultLeagueId || '')

  if (!open) return null

  const countRawOpen = getLeagueMemberPlayerCount?.(resolvedLeagueId || form.leagueId)
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
    const countRaw = getLeagueMemberPlayerCount?.(resolvedLeagueId || form.leagueId)
    const rosterCap = Math.max(1, countRaw !== undefined && countRaw !== null ? countRaw : maxRoster)
    const maxPlayers = Math.min(Math.max(4, Number(form.maxPlayers) || 4), Math.max(4, rosterCap))
    const budget = Math.min(Math.max(10, Number(form.budgetPerTeam) || 50), 200)
    const payload = {
      leagueId: resolvedLeagueId || form.leagueId || defaultLeagueId || leagues?.[0]?.id,
      title: form.title.trim(),
      dateIso: form.dateIso,
      time24: form.time24,
      location: form.location.trim() || 'TBD',
      format: form.format,
      budgetPerTeam: budget,
      maxPlayers,
      status: form.status,
    }
    if (mode === 'create' || mode === 'edit') {
      const n = Math.min(8, Math.max(2, Number(form.teamCount) || 2))
      const names = Array.isArray(form.teamNames) ? [...form.teamNames] : []
      while (names.length < n) names.push(`Team ${names.length + 1}`)
      payload.teams = Array.from({ length: n }, (_, i) => ({
        name: String(names[i] || `Team ${i + 1}`)
          .trim()
          .slice(0, 50) || `Team ${i + 1}`,
      }))
    }
    onSubmit(payload)
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
        <p className="meta">
          {mode === 'create'
            ? 'Set schedule, budget, expected roster size, and team names. Teams are created when you save.'
            : 'Update session details, roster size, and teams (names and how many). Captains are set from the session page.'}
        </p>

        <div className="form-stack">
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
            <span className="field-hint">Draft budget cap for each team during this session.</span>
          </label>

          {mode === 'create' || mode === 'edit' ? (
            <>
              <label className="field">
                <span className="field-label">Number of teams</span>
                <select
                  className="field-input"
                  value={form.teamCount}
                  onChange={(e) => {
                    const n = Math.min(8, Math.max(2, Number(e.target.value) || 2))
                    setForm((prev) => {
                      const names = [...(Array.isArray(prev.teamNames) ? prev.teamNames : [])]
                      while (names.length < n) names.push(`Team ${names.length + 1}`)
                      return { ...prev, teamCount: n, teamNames: names.slice(0, n) }
                    })
                  }}
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} teams
                    </option>
                  ))}
                </select>
              </label>
              {mode === 'edit' ? (
                <p className="field-hint">
                  Reducing the number of teams removes the extra teams from the end (matches tied to removed teams are
                  cleared). Increasing adds empty teams.
                </p>
              ) : null}
              {Array.from({ length: form.teamCount }, (_, i) => (
                <label key={i} className="field">
                  <span className="field-label">Team {i + 1} name</span>
                  <input
                    className="field-input"
                    value={form.teamNames[i] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((prev) => {
                        const names = [...(Array.isArray(prev.teamNames) ? prev.teamNames : [])]
                        while (names.length < prev.teamCount) names.push(`Team ${names.length + 1}`)
                        names[i] = v
                        return { ...prev, teamNames: names }
                      })
                    }}
                    maxLength={50}
                    autoComplete="off"
                  />
                </label>
              ))}
            </>
          ) : null}

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
