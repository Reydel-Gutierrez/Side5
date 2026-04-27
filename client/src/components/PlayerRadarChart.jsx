import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

/** Map raw stats to 0–100 for a balanced pentagon (mock “last 20 games”). */
export function playerToRadarData(player) {
  if (!player) return []
  const scoring = Math.min(100, Math.round((player.goals / 15) * 87.5))
  const playmaking = Math.min(100, Math.round((player.assists / 18) * 100))
  const winning = Math.min(100, Math.round(player.winRate))
  const form = Math.min(100, Math.round((player.rating / 10) * 100))
  const clutch = Math.min(100, Math.round(player.mvps * 15))
  return [
    { subject: 'Scoring', value: scoring },
    { subject: 'Playmaking', value: playmaking },
    { subject: 'Winning', value: winning },
    { subject: 'Form', value: form },
    { subject: 'Clutch', value: clutch },
  ]
}

const tickStyle = { fill: '#f2e7d2', fontSize: 11, fontWeight: 600 }

function PlayerRadarChart({ player }) {
  const data = playerToRadarData(player)

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
