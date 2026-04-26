import { players } from '../data/mockData'

function Profile() {
  const captain = players[0]

  return (
    <div className="screen">
      <h1 className="page-title">Profile</h1>
      <section className="card">
        <h3>{captain.name}</h3>
        <p className="meta">Market Value: ${captain.marketValue.toFixed(1)}M</p>
        <p className="meta">Rating: {captain.rating.toFixed(1)}</p>
      </section>
    </div>
  )
}

export default Profile
