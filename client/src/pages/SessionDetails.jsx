import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import SessionFormModal from '../components/SessionFormModal'
import SessionCaptainModal from '../components/SessionCaptainModal'
import StatusChip from '../components/StatusChip'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'
import { sessionStatusTone } from '../utils/sessionStatus'

function initialsFromDisplayName(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function rosterAttendanceChip(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'confirmed') {
    return <StatusChip tone="confirmed">Confirmed</StatusChip>
  }
  if (s === 'declined') {
    return <StatusChip tone="orange">Declined</StatusChip>
  }
  return <StatusChip tone="invited">Invited</StatusChip>
}

function SessionDetails() {
  const { sessionId } = useParams()
  const { canManageLeague, updateSession, currentUser, currentUserId, refreshSessionsFromApi } = useMockApp()
  const [session, setSession] = useState(null)
  const [roster, setRoster] = useState([])
  const [sessionTeams, setSessionTeams] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [captainOpen, setCaptainOpen] = useState(false)

  const reloadSession = useCallback(async () => {
    const response = await apiFetch(`/api/sessions/${sessionId}`)
    const sessionData = response?.data || null
    setSession(sessionData)
    setRoster(Array.isArray(sessionData?.players) ? sessionData.players : [])
    try {
      const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, { cache: 'no-store' })
      setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : [])
    } catch {
      setSessionTeams([])
    }
    try {
      await refreshSessionsFromApi?.()
    } catch {
      /* keep session details usable even if context refresh fails */
    }
  }, [sessionId, refreshSessionsFromApi])

  useEffect(() => {
    let active = true
    ;(async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await apiFetch(`/api/sessions/${sessionId}`)
        if (!active) return
        const sessionData = response?.data || null
        setSession(sessionData)
        setRoster(Array.isArray(sessionData?.players) ? sessionData.players : [])
        try {
          const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, { cache: 'no-store' })
          if (!active) return
          setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : [])
        } catch {
          if (active) setSessionTeams([])
        }
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Failed to load session details.')
      } finally {
        if (active) setIsLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [sessionId])

  const headerSubtitle = useMemo(() => {
    if (!session?.session_date) return ''
    const d = session.session_date
    const dateStr = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : String(d).slice(0, 10)
    const t = session.session_time != null ? String(session.session_time).slice(0, 5) : ''
    return t ? `${dateStr} ${'\u00b7'} ${t}` : dateStr
  }, [session])

  const memberCap = useMemo(() => Math.max(1, roster.length), [roster])

  const myAttendance = useMemo(() => {
    if (!currentUser?.id) return null
    return roster.find((p) => String(p.user_id) === String(currentUser.id)) ?? null
  }, [roster, currentUser?.id])

  const attendanceConfirmed = myAttendance?.status === 'confirmed'
  const currentUserIsSessionCaptain = useMemo(() => {
    if (!currentUserId) return false
    return sessionTeams.some((team) => String(team?.captain_user_id ?? '') === String(currentUserId))
  }, [sessionTeams, currentUserId])
  if (isLoading) {
    return (
      <div className="screen">
        <PageHeader title="Session" />
        <section className="card">
          <p className="meta">Loading...</p>
        </section>
      </div>
    )
  }
  if (!session) return <Navigate to="/sessions" replace />

  const canManage = Boolean(session.league_id != null && canManageLeague(String(session.league_id)))
  const actingUserNumeric = Number.parseInt(String(currentUserId ?? ''), 10)
  const sessionIdLooksNumeric = /^\d+$/.test(String(sessionId))
  const canUseSessionCaptainUi =
    canManage &&
    sessionIdLooksNumeric &&
    Number.isInteger(actingUserNumeric) &&
    String(actingUserNumeric) === String(currentUserId)

  const handleEditSubmit = async (payload) => {
    const result = await updateSession(session.id, payload, session.league_id)
    if (!result.ok) {
      window.alert(result.reason || 'Could not update session.')
      return
    }
    setEditOpen(false)
    try {
      await reloadSession()
    } catch (e) {
      window.alert(e?.message || 'Saved, but failed to refresh the page.')
    }
  }

  const handleConfirm = async () => {
    if (!currentUser?.id) return
    try {
      await apiFetch(`/api/sessions/${session.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id }),
      })
      const refreshed = await apiFetch(`/api/sessions/${sessionId}`)
      const sessionData = refreshed?.data || null
      setSession(sessionData)
      setRoster(Array.isArray(sessionData?.players) ? sessionData.players : [])
      try {
        const teamsRes = await apiFetch(`/api/sessions/${sessionId}/teams`, { cache: 'no-store' })
        setSessionTeams(Array.isArray(teamsRes?.data) ? teamsRes.data : [])
      } catch {
        setSessionTeams([])
      }
    } catch (requestError) {
      window.alert(requestError.message || 'Failed to confirm attendance.')
    }
  }

  return (
    <div className="screen">
      <PageHeader
        title={session.title}
        subtitle={headerSubtitle}
        rightContent={
          canManage ? (
            <div className="page-header-actions">
              <SecondaryButton type="button" className="header-cta" onClick={() => setEditOpen(true)}>
                Edit session
              </SecondaryButton>
              {canUseSessionCaptainUi ? (
                <SecondaryButton type="button" className="header-cta" onClick={() => setCaptainOpen(true)}>
                  Choose captain
                </SecondaryButton>
              ) : null}
            </div>
          ) : null
        }
      />

      {session.league_name ? (
        <p className="meta session-league-line">League: {session.league_name}</p>
      ) : null}

      <SessionFormModal
        open={editOpen}
        mode="edit"
        session={session}
        maxRoster={roster.length}
        getLeagueMemberPlayerCount={() => roster.length}
        leagues={[]}
        defaultLeagueId={session.league_id}
        existingTeams={sessionTeams}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
      />

      {canUseSessionCaptainUi ? (
        <SessionCaptainModal
          open={captainOpen}
          onClose={() => setCaptainOpen(false)}
          sessionId={sessionId}
          leagueId={session.league_id}
          actingUserId={actingUserNumeric}
          sessionTitle={session.title}
          onUpdated={reloadSession}
        />
      ) : null}

      <section className="card">
        {isLoading ? <p className="meta">Loading...</p> : null}
        {error ? <p className="meta">{error}</p> : null}
        <p className="meta">{session.location}</p>
        <StatusChip tone={sessionStatusTone(session.status)}>{session.status.replace(/_/g, ' ')}</StatusChip>
        <div className="info-grid">
          <div>
            <p className="meta">Format</p>
            <p>{session.format}</p>
          </div>
          <div>
            <p className="meta">Budget</p>
            <p>${session.budget_per_team}M / team</p>
          </div>
          <div>
            <p className="meta">Teams</p>
            <p>{sessionTeams.length}</p>
          </div>
          <div>
            <p className="meta">Players</p>
            <p>
              {roster.length}
            </p>
          </div>
        </div>
      </section>

      <div className="button-row">
        {attendanceConfirmed ? (
          <SecondaryButton type="button" disabled>
            Attendance confirmed
          </SecondaryButton>
        ) : (
          <SecondaryButton type="button" onClick={handleConfirm}>
            Confirm attendance
          </SecondaryButton>
        )}
        <Link to={`/draft/${session.id}`}>
          <PrimaryButton className="w-full">View Draft</PrimaryButton>
        </Link>
      </div>

      <p className="section-label">Players</p>
      <section className="card">
        <p className="meta">Roster is limited to confirmed league members ({memberCap} in this league).</p>
        <div className="screen-stack league-members-grid session-roster-grid">
          {roster.length === 0 ? <p className="meta">No players on this session yet.</p> : null}
          {roster.map((player) => {
            const displayName = player.display_name || player.username || 'Player'
            const initials = initialsFromDisplayName(displayName)
            const rating = Number(player.rating) || 0
            const overall = rating > 0 ? Math.round(rating * 10) : '\u2014'
            const worth = Number(player.base_value) || 0
            const dot = '\u00b7'
            const metricsTail = ` ${dot} OVR ${overall} ${dot} $${worth.toFixed(1)}M`
            const avatarSrc = player.avatar_image ? String(player.avatar_image).trim() : ''
            return (
              <Link
                key={player.user_id}
                to={`/players/${player.user_id}?from=session&sessionId=${encodeURIComponent(String(sessionId))}`}
                className="league-member-mini-card session-roster-card"
                title={`${displayName}${metricsTail}`}
                aria-label={`${displayName}${metricsTail}`}
              >
                <div className="avatar league-member-mini-card__avatar">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="hero-card-main__avatar-image" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="league-member-mini-card__body">
                  <span className="league-member-mini-card__name">{displayName}</span>
                  <span className="league-member-mini-card__metrics">{metricsTail}</span>
                </div>
                <div className="session-roster-card__status">{rosterAttendanceChip(player.status)}</div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default SessionDetails
