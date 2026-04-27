/** League: owner | manager | player. Session/team: captain */
function RoleChip({ role }) {
  const config = {
    owner: { label: 'Owner', key: 'owner' },
    manager: { label: 'Manager', key: 'manager' },
    player: { label: 'Player', key: 'player' },
    captain: { label: 'Captain', key: 'captain' },
  }
  const { label, key } = config[role] ?? { label: role, key: 'player' }
  return (
    <span className={`role-chip role-chip--${key}`} data-role={key}>
      {label}
    </span>
  )
}

export default RoleChip
