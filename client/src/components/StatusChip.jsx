function StatusChip({ children, tone = 'default', className = '' }) {
  return <span className={`status-chip status-chip-${tone} ${className}`.trim()}>{children}</span>
}

export default StatusChip
