function ResultCard({ result }) {
  return (
    <section className="card result-card">
      <p className="meta result-time">{result.dateTime}</p>
      <div className="result-grid">
        <span className="team-name">{result.home.toUpperCase()}</span>
        <span className="scoreline">
          {result.homeScore} - {result.awayScore}
        </span>
        <span className="team-name">{result.away.toUpperCase()}</span>
      </div>
      <p className="meta mvp-line">
        MVP: {result.mvp} <span className="star">⭐</span> {result.mvpRating}
      </p>
    </section>
  )
}

export default ResultCard
