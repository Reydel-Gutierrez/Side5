export const PLAY_STYLE_OPTIONS = [
  { key: 'positioning', label: 'Positioning' },
  { key: 'fast', label: 'Fast' },
  { key: 'intelligent', label: 'Intelligent' },
  { key: 'sniper', label: 'Sniper' },
  { key: 'strong', label: 'Strong' },
  { key: 'skilled', label: 'Skilled' },
  { key: 'creative', label: 'Creative' },
  { key: 'defensive', label: 'Defensive' },
  { key: 'clutch', label: 'Clutch' },
  { key: 'leader', label: 'Leader' },
  { key: 'aggressive', label: 'Aggressive' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'passer', label: 'Passer' },
  { key: 'dribbler', label: 'Dribbler' },
]

/** Radar chart data from API summary (falls back to empty baseline). */
export function radarDataFromSummary(summary) {
  if (Array.isArray(summary?.style_radar) && summary.style_radar.length) {
    return summary.style_radar.map((point) => ({
      subject: point.subject,
      value: Number(point.value) || 0,
    }))
  }
  return PLAY_STYLE_OPTIONS.map((opt) => ({ subject: opt.label, value: 0 }))
}
