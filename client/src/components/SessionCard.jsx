function SessionCard({ title, date, time, attendance, status }) {
  return (
    <section className="card next-game-card">
      <p className="eyebrow">Next game</p>
      <h2>{title}</h2>
      <p className="meta">
        {date} • {time}
      </p>
      <p className="meta">{attendance}</p>
      <p className="status-pill">{status}</p>
      <div className="button-row">
        <button type="button" className="btn btn-secondary">
          View Details
        </button>
        <button type="button" className="btn btn-primary">
          Join
        </button>
      </div>
    </section>
  )
}

export default SessionCard
