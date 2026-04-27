import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ApproveStats from './pages/ApproveStats'
import Draft from './pages/Draft'
import ForgotPassword from './pages/auth/ForgotPassword'
import Home from './pages/Home'
import Login from './pages/Login'
import LoginMain from './pages/auth/Login-main'
import LeagueDetail from './pages/LeagueDetail'
import Leagues from './pages/Leagues'
import MatchResult from './pages/MatchResult'
import PlayerProfile from './pages/PlayerProfile'
import Profile from './pages/Profile'
import Signup from './pages/auth/Signup'
import SessionDetails from './pages/SessionDetails'
import Sessions from './pages/Sessions'
import Stats from './pages/Stats'
import SubmitStats from './pages/SubmitStats'
import TeamsLocked from './pages/TeamsLocked'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login-main" element={<LoginMain />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/leagues/:leagueId" element={<LeagueDetail />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/sessions/:sessionId" element={<SessionDetails />} />
        <Route path="/draft/:sessionId" element={<Draft />} />
        <Route path="/teams-locked/:sessionId" element={<TeamsLocked />} />
        <Route path="/matches/:matchId" element={<MatchResult />} />
        <Route path="/matches/:matchId/submit-stats" element={<SubmitStats />} />
        <Route path="/matches/:matchId/approve-stats" element={<ApproveStats />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/players/:playerId" element={<PlayerProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
