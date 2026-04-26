import StatCard from '../components/StatCard'

function Sessions() {
  return (
    <div className="screen">
      <h1 className="page-title">Sessions</h1>
      <StatCard title="Upcoming Sessions">
        <p className="meta">Your next sessions will appear here.</p>
      </StatCard>
    </div>
  )
}

export default Sessions
