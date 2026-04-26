import { players } from '../data/mockData'

function Stats() {
  return (
    <div className="screen">
      <h1 className="page-title">Stats</h1>
      <section className="card">
        <h3>Top Players</h3>
        <ul className="player-list">
          {players.map((player) => (
            <li key={player.name}>
              <span>{player.name}</span>
              <span>{player.rating.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default Stats
