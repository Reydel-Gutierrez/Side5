import { Navigate, useParams } from 'react-router-dom'
import ProfilePlayerLayout from '../components/ProfilePlayerLayout'
import { useMockApp } from '../context/MockAppContext'

function PlayerProfile() {
  const { playerId } = useParams()
  const { players, currentUser } = useMockApp()

  const player = players.find((item) => item.id === playerId)
  if (!player) return <Navigate to="/stats" replace />

  const accountDetails =
    currentUser?.playerId === player.id
      ? {
          email: currentUser.email,
          username: currentUser.username,
          phone: currentUser.phone,
          memberSince: currentUser.memberSince,
          playerId: currentUser.playerId,
        }
      : null

  return (
    <ProfilePlayerLayout
      player={player}
      backTo="/stats"
      accountDetails={accountDetails}
      identityExtra={null}
      afterRadar={null}
    />
  )
}

export default PlayerProfile
