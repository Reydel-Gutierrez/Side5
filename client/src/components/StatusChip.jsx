function StatusChip({ children, tone = 'default' }) {
  return <span className={`status-chip status-chip-${tone}`}>{children}</span>
}

export default StatusChip
