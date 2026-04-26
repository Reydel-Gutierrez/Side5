function GameCard({ game }) {
  return (
    <section className="card game-card">
      <div className="game-card__row">
        <div className="game-badge">{game.badge}</div>
        <div>
          <h2 className="game-title">{game.title}</h2>
          <p className="meta">{game.dateTime}</p>
          <p className="meta">{game.attendance}</p>
          <p className="status-pill">{game.status}</p>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="btn btn-outline">
          View Details
        </button>
        <button type="button" className="btn btn-primary">
          Join
        </button>
      </div>
    </section>
  )
}

export default GameCard
