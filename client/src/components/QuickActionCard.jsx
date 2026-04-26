function QuickActionCard({ label }) {
  return (
    <button type="button" className="quick-action-card">
      <span className="quick-action-icon">▣</span>
      <span>{label}</span>
    </button>
  )
}

export default QuickActionCard
