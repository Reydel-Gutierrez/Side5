import { NavLink } from 'react-router-dom'

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const navItems = [
  {
    to: '/',
    label: 'Home',
    end: true,
    icon: (
      <Icon>
        <path d="M3 11.2 12 4l9 7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.8 10.5V20h10.4v-9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    to: '/league',
    label: 'League',
    icon: (
      <Icon>
        <path d="M4 7h6v10H4zM14 7h6v4h-6zM14 13h6v4h-6z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 4v3M17 4v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    to: '/sessions',
    label: 'Sessions',
    icon: (
      <Icon>
        <rect x="4" y="5" width="16" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.8v2.7M16 3.8v2.7M4 9.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (
      <Icon>
        <path d="M5 18V9M12 18V5M19 18v-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <Icon>
        <circle cx="12" cy="8.2" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 19.2c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </Icon>
    ),
  },
]

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
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
