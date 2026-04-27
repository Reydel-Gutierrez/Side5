import BottomNav from './BottomNav'
import { useLocation } from 'react-router-dom'
import { useMockApp } from '../context/MockAppContext'

function AppShell({ children }) {
  const location = useLocation()
  const { currentUserId } = useMockApp()
  const authRoutes = ['/login', '/login-main', '/signup', '/forgot-password']
  const isAuthRoute = authRoutes.includes(location.pathname)
  const showBottomNav = Boolean(currentUserId) && !isAuthRoute

  return (
    <div className={`app-shell ${isAuthRoute ? 'app-shell--login' : ''}`.trim()}>
      {showBottomNav ? <BottomNav /> : null}
      <main className={`app-content ${isAuthRoute ? 'app-content--login' : ''}`.trim()}>{children}</main>
    </div>
  )
}

export default AppShell
