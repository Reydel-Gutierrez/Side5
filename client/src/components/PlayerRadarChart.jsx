import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'

const tickStyle = { fill: '#f2e7d2', fontSize: 11, fontWeight: 600 }

function PlayerRadarChart({ data = [] }) {

  return (
    <section className="card player-radar-card">
      <p className="player-radar-kicker">LAST 20 GAMES</p>
      <h3 className="player-radar-heading">PLAYER STYLE</h3>
      <div className="player-radar-chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart
            cx="50%"
            cy="52%"
            outerRadius="72%"
            data={data}
            margin={{ top: 12, right: 18, bottom: 12, left: 18 }}
          >
            <PolarGrid stroke="rgba(242, 231, 210, 0.12)" strokeDasharray="3 3" />
            <PolarAngleAxis dataKey="subject" tick={tickStyle} tickLine={false} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Style"
              dataKey="value"
              stroke="#e86f45"
              strokeWidth={2.2}
              fill="#e86f45"
              fillOpacity={0.34}
              isAnimationActive
              dot={{
                r: 4,
                fill: '#f2e7d2',
                stroke: '#e86f45',
                strokeWidth: 2,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default PlayerRadarChart
