import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Draft from './pages/Draft'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Sessions from './pages/Sessions'
import Stats from './pages/Stats'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
