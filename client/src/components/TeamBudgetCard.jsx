function TeamBudgetCard({ team, budgetLimit, selected, onSelect }) {
  const budgetPercent = Math.min((team.budgetUsed / budgetLimit) * 100, 100)

  return (
    <button type="button" className={`team-budget-card ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <p className="session-title">{team.name}</p>
      <p className="meta">Captain: {team.captainName}</p>
      <p className="meta">
        ${team.budgetUsed.toFixed(1)}M / ${budgetLimit}M
      </p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${budgetPercent}%` }} />
      </div>
    </button>
  )
}

export default TeamBudgetCard
