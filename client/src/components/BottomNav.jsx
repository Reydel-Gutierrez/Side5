import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/sessions', label: 'Sessions', icon: '◫' },
  { to: '/draft', label: 'Draft', icon: '▦' },
  { to: '/stats', label: 'Stats', icon: '◔' },
  { to: '/profile', label: 'Profile', icon: '◉' },
]

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'is-active' : ''}`}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
