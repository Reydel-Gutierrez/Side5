import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'
import { sessionStatusTone } from '../utils/sessionStatus'

const TEAM_HEADER_CLASS = ['draft-team-col--a', 'draft-team-col--b', 'draft-team-col--c', 'draft-team-col--d']

const MIN_PLAYER_ROWS = 6

function initialsFromDisplayName(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function statusLabelForSession(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'draft_pending') return 'Draft pending'
  if (s === 'drafting') return 'Drafting'
  if (s === 'locked') return 'Locked'
  if (s === 'completed') return 'Completed'
  if (s === 'open') return 'Open'
  return s ? s.replace(/_/g, ' ') : 'Draft'
}

function Draft() {
  const { sessionId } = useParams()
  const { currentUserId, canManageLeague } = useMockApp()
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [roster, setRoster] = useState([])
  const [teamPlayerMap, setTeamPlayerMap] = useState({})
  const [benchShuffleAssignments, setBenchShuffleAssignments] = useState([])
  const [unassignedBenchCount, setUnassignedBenchCount] = useState(0)
  const [minPlayersPerTeamToLock, setMinPlayersPerTeamToLock] = useState(5)
  const [busy, setBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [priceFilter, setPriceFilter] = useState('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const numericSessionId = Number.parseInt(String(sessionId), 10)

  const loadDraft = async () => {
    if (Number.isNaN(numericSessionId)) return
    const draftRes = await apiFetch(`/api/sessions/${numericSessionId}/draft`, { cache: 'no-store' })
    const payload = draftRes?.data || {}
    setSession(payload.session || null)
    setTeams(Array.isArray(payload.teams) ? payload.teams : [])
    const rosterRows = Array.isArray(payload.roster) ? payload.roster : []
    setRoster(rosterRows)
    const rows = Array.isArray(payload.teamPlayers) ? payload.teamPlayers : []
    const nextMap = {}
    rows.forEach((row) => {
      const teamKey = String(row.team_id)
      if (!nextMap[teamKey]) nextMap[teamKey] = []
      nextMap[teamKey].push(String(row.user_id))
    })
    setTeamPlayerMap(nextMap)
    setBenchShuffleAssignments(Array.isArray(payload.benchShuffleAssignments) ? payload.benchShuffleAssignments : [])
    setUnassignedBenchCount(Number(payload.unassignedBenchCount) || 0)
    setMinPlayersPerTeamToLock(Number(payload.minPlayersPerTeamToLock) || 5)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (Number.isNaN(numericSessionId)) return
      setLoading(true)
      setError('')
      try {
        await loadDraft()
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Failed to load draft.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [numericSessionId])

  useEffect(() => {
    if (Number.isNaN(numericSessionId)) return undefined
    const timer = window.setInterval(() => {
      loadDraft().catch(() => {})
    }, 10000)
    return () => window.clearInterval(timer)
  }, [numericSessionId])

  useEffect(() => {
    if (!toastMessage) return undefined
    const t = window.setTimeout(() => setToastMessage(''), 4800)
    return () => window.clearTimeout(t)
  }, [toastMessage])

  const rosterMap = useMemo(() => {
    const map = {}
    roster.forEach((row) => {
      map[String(row.user_id)] = row
    })
    return map
  }, [roster])

  const draftedIds = useMemo(() => {
    const set = new Set()
    Object.values(teamPlayerMap).forEach((ids) => ids.forEach((uid) => set.add(String(uid))))
    teams.forEach((team) => {
      if (team?.captain_user_id != null) {
        set.add(String(team.captain_user_id))
      }
    })
    return set
  }, [teamPlayerMap, teams])

  const availablePlayers = useMemo(
    () => roster.filter((p) => !draftedIds.has(String(p.user_id))),
    [roster, draftedIds],
  )

  const getPlayerCost = (userId) => Number(rosterMap[String(userId)]?.base_value) || 0

  const playerOvrWorth = (player, fallbackName = '—') => {
    if (!player) return { displayName: fallbackName, ovr: '\u2014', worth: 0 }
    const displayName = player.display_name || player.username || fallbackName || 'Player'
    const worth = Number(player.base_value) || 0
    const ovr = Number(player.rating) > 0 ? Math.round(Number(player.rating) * 10) : '\u2014'
    return { displayName, ovr, worth }
  }

  const teamsDecorated = useMemo(
    () =>
      teams.map((team) => {
        const teamKey = String(team.id)
        const playerIds = teamPlayerMap[teamKey] ?? []
        const captainUserId = team.captain_user_id != null ? String(team.captain_user_id) : null
        const captainName = captainUserId
          ? rosterMap[captainUserId]?.display_name || rosterMap[captainUserId]?.username || '—'
          : '—'
        const budgetPlayerIds = captainUserId && !playerIds.includes(captainUserId) ? [captainUserId, ...playerIds] : playerIds
        const budgetUsed = Number(budgetPlayerIds.reduce((sum, uid) => sum + getPlayerCost(uid), 0).toFixed(2))
        const isLocked = Number(team.is_locked) === 1
        return { ...team, playerIds, captainUserId, captainName, budgetUsed, isLocked }
      }),
    [teams, teamPlayerMap, rosterMap],
  )

  const captainTeams = useMemo(
    () => teamsDecorated.filter((team) => String(team.captainUserId || '') === String(currentUserId || '')),
    [teamsDecorated, currentUserId],
  )

  const canManageSessionLeague = Boolean(
    session?.league_id != null && canManageLeague(String(session.league_id)),
  )
  const activeCaptainTeam = captainTeams[0] || null
  const canWriteDraft = Boolean(activeCaptainTeam)
  const activeTeamId = activeCaptainTeam ? String(activeCaptainTeam.id) : ''

  const pushToast = (msg) => {
    setToastMessage(msg)
  }

  const handleDraftPlayer = async (playerUserId) => {
    if (!session || busy || !canWriteDraft) return
    const actorId = Number.parseInt(String(currentUserId ?? ''), 10)
    if (Number.isNaN(actorId)) {
      pushToast('Log in to draft players.')
      return
    }
    const team = teamsDecorated.find((row) => String(row.id) === String(activeTeamId))
    if (!team) {
      pushToast('Pick a team to add this player to.')
      return
    }
    if (team.isLocked) {
      pushToast('Your team is locked. You cannot add players.')
      return
    }

    const cost = getPlayerCost(playerUserId)
    const budgetLimit = Number(session.budget_per_team) || 0
    if (Number(team.budgetUsed) + cost > budgetLimit) {
      pushToast(`Budget exceeded for ${team.name}.`)
      return
    }

    try {
      setBusy(true)
      await apiFetch(`/api/sessions/${session.id}/teams/${team.id}/players`, {
        method: 'POST',
        body: JSON.stringify({
          actingUserId: actorId,
          userId: Number.parseInt(String(playerUserId), 10),
        }),
      })
      await loadDraft()
    } catch (err) {
      pushToast(err?.message || 'Could not draft player.')
    } finally {
      setBusy(false)
    }
  }

  const canRemovePlayerFromTeam = (team) =>
    (String(team.captainUserId || '') === String(currentUserId || '') || canManageSessionLeague) && !team.isLocked

  const allTeamsLocked = teamsDecorated.length > 0 && teamsDecorated.every((t) => t.isLocked)
  const benchShuffleDone = Number(session?.bench_shuffle_done) === 1

  const isCaptainOfTeam = (team) => String(team.captainUserId || '') === String(currentUserId || '')

  /** Roster size for lock rules: distinct picks + captain if not already in team_players (matches server). */
  const rosterCountForLockTeam = (team) => {
    const cap = team.captainUserId ? String(team.captainUserId) : null
    const uidSet = new Set((team.playerIds || []).map(String))
    if (cap) uidSet.add(cap)
    return uidSet.size
  }

  const canLockTeam = (team) => {
    if (team.isLocked) return false
    if (!isCaptainOfTeam(team)) return false
    return rosterCountForLockTeam(team) >= minPlayersPerTeamToLock
  }

  const showUnlockForTeam = (team) => team.isLocked && isCaptainOfTeam(team) && !benchShuffleDone

  const handleLockTeam = async (team) => {
    if (!session || busy || !canLockTeam(team)) return
    const actorId = Number.parseInt(String(currentUserId ?? ''), 10)
    if (Number.isNaN(actorId)) return
    try {
      setBusy(true)
      const res = await apiFetch(`/api/sessions/${session.id}/teams/${team.id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ actingUserId: actorId }),
      })
      await loadDraft()
      const d = res?.data || {}
      if (d.allTeamsLocked && d.benchShuffle?.ran) {
        pushToast(`All teams locked. ${d.benchShuffle.assigned || 0} bench player(s) randomly assigned.`)
      } else {
        pushToast('Team locked.')
      }
    } catch (err) {
      pushToast(err?.message || 'Could not lock team.')
    } finally {
      setBusy(false)
    }
  }

  const handleUnlockTeam = async (team) => {
    if (!session || busy || !showUnlockForTeam(team)) return
    const actorId = Number.parseInt(String(currentUserId ?? ''), 10)
    if (Number.isNaN(actorId)) return
    try {
      setBusy(true)
      await apiFetch(`/api/sessions/${session.id}/teams/${team.id}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ actingUserId: actorId }),
      })
      await loadDraft()
      pushToast('Team unlocked.')
    } catch (err) {
      pushToast(err?.message || 'Could not unlock team.')
    } finally {
      setBusy(false)
    }
  }

  const benchShuffleByTeam = useMemo(() => {
    const map = {}
    benchShuffleAssignments.forEach((row) => {
      const tid = String(row.teamId)
      if (!map[tid]) map[tid] = []
      map[tid].push(String(row.userId))
    })
    return map
  }, [benchShuffleAssignments])

  const handleUndraftPlayer = async (team, playerUserId) => {
    if (!session || busy) return
    if (!canRemovePlayerFromTeam(team)) return
    const actorId = Number.parseInt(String(currentUserId ?? ''), 10)
    if (Number.isNaN(actorId)) {
      pushToast('Log in to remove players.')
      return
    }
    try {
      setBusy(true)
      await apiFetch(`/api/sessions/${session.id}/teams/${team.id}/players/${playerUserId}`, {
        method: 'DELETE',
        body: JSON.stringify({ actingUserId: actorId }),
      })
      await loadDraft()
    } catch (err) {
      pushToast(err?.message || 'Could not remove player.')
    } finally {
      setBusy(false)
    }
  }

  const budgetLimitNum = Number(session?.budget_per_team) || 0

  const summaryStats = useMemo(() => {
    if (!session) return null
    const nTeams = teamsDecorated.length
    const draftedCount = draftedIds.size
    const avgValue =
      roster.length > 0
        ? roster.reduce((s, p) => s + (Number(p.base_value) || 0), 0) / roster.length
        : 0
    return {
      nTeams,
      budgetPerTeam: budgetLimitNum,
      draftedCount,
      poolTotal: roster.length,
      avgValue,
    }
  }, [session, teamsDecorated.length, draftedIds, roster, budgetLimitNum])

  const filteredAvailable = useMemo(() => {
    let list = availablePlayers
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const name = `${p.display_name || ''} ${p.username || ''}`.toLowerCase()
        return name.includes(q)
      })
    }
    if (priceFilter === 'low') {
      list = list.filter((p) => (Number(p.base_value) || 0) < 10)
    } else if (priceFilter === 'high') {
      list = list.filter((p) => (Number(p.base_value) || 0) >= 10)
    }
    return list
  }, [availablePlayers, searchQuery, priceFilter])

  if (!Number.isNaN(numericSessionId) && loading) {
    return (
      <div className="screen">
        <PageHeader title="Draft" />
        <section className="card">
          <p className="meta">Loading draft...</p>
        </section>
      </div>
    )
  }
  if (!session) return <Navigate to="/sessions" replace />

  const statusTone = String(session.status || '').toLowerCase() === 'drafting' ? 'orange' : sessionStatusTone(session.status)
  const statusChipLabel = statusLabelForSession(session.status)
  const boardManyTeams = teamsDecorated.length >= 4

  return (
    <div className="screen draft-page">
      <PageHeader
        title="Draft"
        subtitle={session.title}
        rightContent={
          <StatusChip tone={statusTone === 'orange' ? 'orange' : 'green'}>{statusChipLabel}</StatusChip>
        }
      />

      {error ? <p className="meta draft-page__error">{error}</p> : null}

      <p className="draft-page__description">
        Captains build their teams. All players can <span className="draft-page__description-accent">watch the draft</span>.
      </p>

      {summaryStats ? (
        <section className="card draft-summary-card">
          <div className="draft-summary-grid">
            <div className="draft-summary-item">
              <span className="draft-summary-item__label">Teams</span>
              <span className="draft-summary-item__value">{summaryStats.nTeams}</span>
            </div>
            <div className="draft-summary-item">
              <span className="draft-summary-item__label">Budget / team</span>
              <span className="draft-summary-item__value">${summaryStats.budgetPerTeam.toFixed(1)}M</span>
            </div>
            <div className="draft-summary-item">
              <span className="draft-summary-item__label">Drafted</span>
              <span className="draft-summary-item__value">
                {summaryStats.draftedCount} / {summaryStats.poolTotal}
              </span>
            </div>
            <div className="draft-summary-item">
              <span className="draft-summary-item__label">Avg value</span>
              <span className="draft-summary-item__value">${summaryStats.avgValue.toFixed(1)}M</span>
            </div>
          </div>
        </section>
      ) : null}

      {!canWriteDraft ? (
        <p className="meta draft-page__readonly-banner">View only — captains are building teams.</p>
      ) : null}

      <section className="card draft-lock-card">
        <p className="session-title">Lock teams</p>
        <p className="meta">
          Only each team captain can lock or unlock their own roster. Locking needs at least {minPlayersPerTeamToLock}{' '}
          players on that team (including the captain), from the session match format. When every team is locked,
          remaining bench players are randomly assigned. Unlock is not available after that shuffle runs.
        </p>
        <p className="meta">
          Teams locked: {teamsDecorated.filter((t) => t.isLocked).length} / {teamsDecorated.length} · Bench still
          unassigned: {unassignedBenchCount}
          {benchShuffleDone ? ' · Bench shuffle complete' : ''}
        </p>
        {allTeamsLocked ? <p className="meta">Every team is locked — bench assignment has run (if there were players left).</p> : null}
      </section>

      <section className={`card draft-board-card ${boardManyTeams ? 'draft-board-card--scroll' : ''}`}>
        <div className={`draft-board-scroll ${boardManyTeams ? 'is-wide' : ''}`}>
          <table className="draft-board-table">
            <thead>
              <tr>
                {teamsDecorated.map((team, colIdx) => (
                  <th key={team.id} className={`draft-board-table__team ${TEAM_HEADER_CLASS[colIdx % TEAM_HEADER_CLASS.length]}`} scope="col">
                    <div className="draft-board-team-head">
                      <span className="draft-board-team-head__name">
                        {team.name}
                        {team.isLocked ? (
                          <span className="draft-board-team-head__locked" title="Locked">
                            {' '}
                            🔒
                          </span>
                        ) : null}
                      </span>
                      <span className="draft-board-team-head__budget">
                        ${team.budgetUsed.toFixed(1)}M / ${budgetLimitNum.toFixed(1)}M
                      </span>
                      {!team.isLocked && isCaptainOfTeam(team) ? (
                        <SecondaryButton
                          type="button"
                          className="draft-board-team-head__lock-btn"
                          disabled={busy || rosterCountForLockTeam(team) < minPlayersPerTeamToLock}
                          title={
                            rosterCountForLockTeam(team) < minPlayersPerTeamToLock
                              ? `Need at least ${minPlayersPerTeamToLock} players on this team (including you) before locking.`
                              : 'Lock your roster for this match.'
                          }
                          onClick={() => handleLockTeam(team)}
                        >
                          Lock team
                        </SecondaryButton>
                      ) : null}
                      {showUnlockForTeam(team) ? (
                        <SecondaryButton
                          type="button"
                          className="draft-board-team-head__lock-btn"
                          disabled={busy}
                          title="Unlock to change picks again (only before bench shuffle)."
                          onClick={() => handleUnlockTeam(team)}
                        >
                          Unlock team
                        </SecondaryButton>
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rowCounts = teamsDecorated.map((team) => {
                  const cap = team.captainUserId ? String(team.captainUserId) : null
                  const others = team.playerIds.filter((uid) => String(uid) !== cap)
                  const withCaptain = cap ? 1 + others.length : others.length
                  return Math.max(MIN_PLAYER_ROWS, withCaptain)
                })
                const maxRows = rowCounts.length ? Math.max(...rowCounts) : MIN_PLAYER_ROWS
                return Array.from({ length: maxRows }, (_, rowIdx) => (
                  <tr key={`slot-${rowIdx}`}>
                    {teamsDecorated.map((team) => {
                      const capId = team.captainUserId ? String(team.captainUserId) : null
                      const others = team.playerIds.filter((uid) => String(uid) !== capId)
                      const slotIds = capId ? [capId, ...others] : others
                      const uid = slotIds[rowIdx]
                      if (!uid) {
                        return (
                          <td key={`${team.id}-empty-${rowIdx}`} className="draft-board-table__slot draft-board-table__slot--empty">
                            —
                          </td>
                        )
                      }
                      const player = rosterMap[String(uid)]
                      if (!player) {
                        return (
                          <td key={`${team.id}-miss-${rowIdx}`} className="draft-board-table__slot draft-board-table__slot--empty">
                            —
                          </td>
                        )
                      }
                      const { displayName, worth } = playerOvrWorth(player)
                      const isCaptainSlot = capId && String(uid) === String(capId)
                      const showRemove = canRemovePlayerFromTeam(team) && !isCaptainSlot
                      return (
                        <td key={`${team.id}-${uid}`} className="draft-board-table__slot">
                          <div className="draft-board-player-cell">
                            <div className="draft-board-player-cell__text">
                              <Link
                                to={`/players/${uid}?from=session&sessionId=${encodeURIComponent(String(session.id))}`}
                                className="draft-board-player-cell__name"
                              >
                                {displayName}
                              </Link>
                              <div className="draft-board-player-cell__meta">
                                <span>${worth.toFixed(1)}M</span>
                              </div>
                              {showRemove ? (
                                <button
                                  type="button"
                                  className="draft-board-player-cell__remove"
                                  disabled={busy}
                                  onClick={() => handleUndraftPlayer(team, uid)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card draft-available-card">
        <div className="draft-available-card__head">
          <p className="draft-available-card__title">
            Available players <span className="draft-available-card__count">({filteredAvailable.length})</span>
          </p>
          <div className="draft-available-filters">
            <button
              type="button"
              className={`draft-filter-chip ${priceFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setPriceFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`draft-filter-chip ${priceFilter === 'low' ? 'is-active' : ''}`}
              onClick={() => setPriceFilter('low')}
            >
              $0 – $10M
            </button>
            <button
              type="button"
              className={`draft-filter-chip ${priceFilter === 'high' ? 'is-active' : ''}`}
              onClick={() => setPriceFilter('high')}
            >
              $10M+
            </button>
            <button
              type="button"
              className={`draft-filter-search-btn ${searchOpen ? 'is-active' : ''}`}
              aria-label={searchOpen ? 'Close search' : 'Search players'}
              onClick={() => setSearchOpen((o) => !o)}
            >
              ⌕
            </button>
          </div>
        </div>
        {searchOpen ? (
          <label className="draft-search-field">
            <span className="visually-hidden">Search players</span>
            <input
              type="search"
              className="field-input draft-search-input"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </label>
        ) : null}

        {activeCaptainTeam ? (
          <p className="meta">
            Drafting for: {activeCaptainTeam.name}
            {activeCaptainTeam.isLocked ? ' (locked — no more adds)' : ''}
          </p>
        ) : null}

        <div className="screen-stack draft-players-list">
          {filteredAvailable.length === 0 ? (
            <p className="meta">{availablePlayers.length === 0 ? 'No players left in the draft pool.' : 'No players match these filters.'}</p>
          ) : null}
          {filteredAvailable.map((player) => {
            const displayName = player.display_name || player.username || 'Player'
            const rating = Number(player.rating) || 0
            const overall = rating > 0 ? Math.round(rating * 10) : '\u2014'
            const worth = Number(player.base_value) || 0
            const activeTeam = teamsDecorated.find((team) => String(team.id) === String(activeTeamId))
            const exceedsBudget = canWriteDraft && activeTeam
              ? Number(activeTeam.budgetUsed) + worth > (Number(session.budget_per_team) || 0)
              : false
            const initials = initialsFromDisplayName(displayName)
            return (
              <div key={player.user_id} className="league-member-mini-card session-roster-card draft-player-row draft-available-row">
                <div className={`draft-available-row__avatar draft-cell-avatar draft-cell-avatar--neutral`} aria-hidden>
                  {initials}
                </div>
                <div className="league-member-mini-card__body draft-available-row__body">
                  <Link
                    to={`/players/${player.user_id}?from=session&sessionId=${encodeURIComponent(String(session.id))}`}
                    className="league-member-mini-card__name"
                  >
                    {displayName}
                  </Link>
                  <span className="league-member-mini-card__metrics">
                    OVR {overall} · ${worth.toFixed(1)}M
                  </span>
                </div>
                <PrimaryButton
                  type="button"
                  className="draft-row-action btn-draft-add"
                  onClick={() => handleDraftPlayer(player.user_id)}
                  disabled={busy || !canWriteDraft || exceedsBudget || Boolean(activeCaptainTeam?.isLocked)}
                  title={
                    !canWriteDraft
                      ? 'View only.'
                      : activeCaptainTeam?.isLocked
                        ? 'Your team is locked.'
                        : exceedsBudget
                          ? 'Over budget for the selected team.'
                          : 'Add to team'
                  }
                >
                  {canWriteDraft ? 'Add' : 'View'}
                </PrimaryButton>
              </div>
            )
          })}
        </div>
      </section>

      {benchShuffleDone ? (
        <section className="card draft-bench-card">
          <p className="session-title">Auto-assigned bench</p>
          {benchShuffleAssignments.length === 0 ? (
            <p className="meta">All teams were locked and there were no remaining bench players to assign.</p>
          ) : (
            <>
              <p className="meta">These players were randomly placed after every team locked.</p>
              {teamsDecorated.map((team) => {
                const ids = benchShuffleByTeam[String(team.id)] || []
                if (!ids.length) return null
                return (
                  <div key={`bench-${team.id}`} className="draft-bench-team">
                    <p className="draft-bench-team__title">{team.name}</p>
                    <ul className="draft-bench-list">
                      {ids.map((uid) => {
                        const p = rosterMap[uid]
                        const { displayName, worth } = playerOvrWorth(p, '—')
                        return (
                          <li key={`${team.id}-${uid}`}>
                            {displayName} · ${worth.toFixed(1)}M
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </>
          )}
        </section>
      ) : null}

      <section className="card draft-how-card">
        <div className="draft-how-card__icon" aria-hidden>
          ⓘ
        </div>
        <div>
          <h2 className="draft-how-card__title">How it works</h2>
          <p className="draft-how-card__text">
            Each team has a ${budgetLimitNum.toFixed(1)}M budget. Captains pick their squad, then lock when they have at
            least {minPlayersPerTeamToLock} on the roster (format-based). When all teams are locked, any remaining bench
            players are randomly assigned. Everyone can follow along live.
          </p>
        </div>
      </section>

      <div className="button-row">
        <Link to={`/sessions/${session.id}`}>
          <SecondaryButton>Back to Session</SecondaryButton>
        </Link>
        <Link to={`/teams-locked/${session.id}`}>
          <PrimaryButton className="w-full">View Teams</PrimaryButton>
        </Link>
      </div>

      {toastMessage ? <p className="meta toast-hint draft-page__toast">{toastMessage}</p> : null}
    </div>
  )
}

export default Draft
