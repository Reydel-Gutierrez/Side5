import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams, useParams } from 'react-router-dom'
import ProfilePlayerLayout from '../components/ProfilePlayerLayout'
import { useMockApp } from '../context/MockAppContext'
import { apiFetch } from '../utils/apiFetch'

function PlayerProfile() {
  const { playerId } = useParams()
  const [searchParams] = useSearchParams()
  const [dbSummary, setDbSummary] = useState(null)
  const [summaryLoaded, setSummaryLoaded] = useState(false)
  const { players, currentUser, activeLeague, getLeaguePlayers, getPlayerIdentity, getPlayerAttributeProfile } = useMockApp()
  const source = searchParams.get('from')
  const sessionIdBack = searchParams.get('sessionId')
  const backTo =
    source === 'league'
      ? '/league'
      : source === 'session' && sessionIdBack && /^\d+$/.test(String(sessionIdBack))
        ? `/sessions/${sessionIdBack}`
        : '/stats'
  const numericProfileId = Number.parseInt(String(playerId ?? ''), 10)
  const canQueryDbProfile = !Number.isNaN(numericProfileId) && String(numericProfileId) === String(playerId ?? '')

  const leaguePlayers = activeLeague ? getLeaguePlayers(activeLeague.id) : players
  const localPlayer = leaguePlayers.find((item) => String(item.id) === String(playerId)) ?? players.find((item) => String(item.id) === String(playerId))

  useEffect(() => {
    let cancelled = false
    if (!canQueryDbProfile) {
      setDbSummary(null)
      setSummaryLoaded(true)
      return undefined
    }
    setSummaryLoaded(false)
    ;(async () => {
      try {
        const leagueId = activeLeague?.id
        const query = /^\d+$/.test(String(leagueId || '')) ? `?leagueId=${Number.parseInt(String(leagueId), 10)}` : ''
        const result = await apiFetch(`/api/players/${numericProfileId}/summary${query}`, { cache: 'no-store' })
        if (!cancelled) setDbSummary(result?.data ?? null)
      } catch {
        if (!cancelled) setDbSummary(null)
      } finally {
        if (!cancelled) setSummaryLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeLeague?.id, canQueryDbProfile, numericProfileId])

  const player = useMemo(() => {
    if (localPlayer) {
      return {
        ...localPlayer,
        games: Number(dbSummary?.matches_played) || localPlayer.games || 0,
        goals: Number(dbSummary?.goals) || localPlayer.goals || 0,
        assists: Number(dbSummary?.assists) || localPlayer.assists || 0,
        saves: Number(dbSummary?.saves) || localPlayer.saves || 0,
        mvps: Number(dbSummary?.mvp_trophies) || localPlayer.mvps || 0,
        value: Number(dbSummary?.total_worth) || localPlayer.value || 10,
        overall: Number(dbSummary?.ovr) || localPlayer.overall || Math.round((localPlayer.rating || 7) * 10),
        rating:
          (Number(dbSummary?.ovr) && Number(dbSummary?.ovr) / 10) ||
          Number(dbSummary?.rating) ||
          localPlayer.rating ||
          7,
      }
    }
    if (!dbSummary) return null
    const displayName = dbSummary.display_name || dbSummary.username || 'Player'
    const initials =
      String(displayName)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'P'
    return {
      id: String(playerId),
      name: displayName,
      initials,
      games: Number(dbSummary.matches_played) || 0,
      goals: Number(dbSummary.goals) || 0,
      assists: Number(dbSummary.assists) || 0,
      saves: Number(dbSummary.saves) || 0,
      mvps: Number(dbSummary.mvp_trophies) || 0,
      winRate: 0,
      rating: (Number(dbSummary.ovr) && Number(dbSummary.ovr) / 10) || Number(dbSummary.rating) || 6,
      value: Number(dbSummary.total_worth) || Number(dbSummary.base_value) || 10,
      overall: Number(dbSummary.ovr) || Math.round(((Number(dbSummary.rating) || 6) * 10)),
    }
  }, [dbSummary, localPlayer, playerId])

  if (!player && !summaryLoaded) {
    return (
      <div className="screen">
        <section className="card">
          <p className="meta">Loading player profile...</p>
        </section>
      </div>
    )
  }
  if (!player) return <Navigate to={backTo} replace />

  const identity = getPlayerIdentity(player.id, activeLeague?.id ?? null)
  const radarData = getPlayerAttributeProfile(player.id, activeLeague?.id ?? null)
  const heroOverall = Number(dbSummary?.ovr) || Math.round((player.overall ?? player.rating * 10) || 70)
  const heroArchetype = dbSummary?.main_archetype || (identity.hasVotes ? identity.mainArchetype : 'None')
  const heroWorth = Number(dbSummary?.total_worth ?? player.value ?? 10)
  const heroMvps = Number(dbSummary?.mvp_trophies ?? player.mvps ?? 0)
  const heroMatches = Number(dbSummary?.matches_played ?? player.games ?? 0)
  const heroAvatarImage = dbSummary?.avatar_image || player.avatarImage || (currentUser?.playerId === player.id ? currentUser.avatarImage || '' : '')

  const accountDetails =
    currentUser?.playerId === player.id
      ? {
          email: currentUser.email,
          displayName: currentUser.displayName,
          username: currentUser.username,
          phone: currentUser.phone,
          memberSince: currentUser.memberSince,
          playerId: currentUser.playerId,
        }
      : null

  return (
    <ProfilePlayerLayout
      player={player}
      backTo={backTo}
      accountDetails={accountDetails}
      profileCardData={{
        greeting: 'Player profile,',
        displayName: dbSummary?.display_name || player.name,
        overall: heroOverall,
        totalWorth: heroWorth.toFixed(1),
        archetype: heroArchetype,
        mvpTrophies: heroMvps,
        matchesPlayed: heroMatches,
        avatarImage: heroAvatarImage,
        avatarFallback: player.initials,
      }}
      identityExtra={null}
      radarData={radarData}
      afterRadar={null}
    />
  )
}

export default PlayerProfile
