import { Navigate } from 'react-router-dom'
import { useMockApp } from '../context/MockAppContext'

function Leagues() {
  const { activeLeague } = useMockApp()
  if (!activeLeague?.id) return <Navigate to="/" replace />
  return <Navigate to="/league" replace />
}

export default Leagues
