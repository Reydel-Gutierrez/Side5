import BottomNav from './BottomNav'

function AppShell({ children }) {
  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
      <BottomNav />
    </div>
  )
}

export default AppShell
