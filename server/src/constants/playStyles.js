/** Play style keys (DB/API) and display labels for radar chart. */
const PLAY_STYLES = [
  { key: 'positioning', label: 'Positioning', column: 'style_positioning' },
  { key: 'fast', label: 'Fast', column: 'style_fast' },
  { key: 'intelligent', label: 'Intelligent', column: 'style_intelligent' },
  { key: 'sniper', label: 'Sniper', column: 'style_sniper' },
  { key: 'strong', label: 'Strong', column: 'style_strong' },
  { key: 'skilled', label: 'Skilled', column: 'style_skilled' },
  { key: 'creative', label: 'Creative', column: 'style_creative' },
  { key: 'defensive', label: 'Defensive', column: 'style_defensive' },
  { key: 'clutch', label: 'Clutch', column: 'style_clutch' },
  { key: 'leader', label: 'Leader', column: 'style_leader' },
  { key: 'aggressive', label: 'Aggressive', column: 'style_aggressive' },
  { key: 'stamina', label: 'Stamina', column: 'style_stamina' },
  { key: 'passer', label: 'Passer', column: 'style_passer' },
  { key: 'dribbler', label: 'Dribbler', column: 'style_dribbler' },
]

const PLAY_STYLE_KEYS = PLAY_STYLES.map((s) => s.key)
const PLAY_STYLE_KEY_SET = new Set(PLAY_STYLE_KEYS)
const KEY_TO_COLUMN = Object.fromEntries(PLAY_STYLES.map((s) => [s.key, s.column]))
const COLUMN_TO_KEY = Object.fromEntries(PLAY_STYLES.map((s) => [s.column, s.key]))
const LABEL_BY_KEY = Object.fromEntries(PLAY_STYLES.map((s) => [s.key, s.label]))

const RADAR_MIN_VALUE = 12
const RADAR_MAX_VALUE = 100

const ARCHETYPES = [
  {
    id: 'Mago',
    description: 'Creative playmaker with strong passing, dribbling, and skill.',
    styles: ['creative', 'passer', 'dribbler', 'skilled'],
  },
  {
    id: 'Fenomeno',
    description: 'Explosive all-around attacker with speed, skill, and finishing.',
    styles: ['fast', 'sniper', 'skilled', 'dribbler'],
  },
  {
    id: 'The Tank',
    description: 'Physical power player who wins battles and protects the team.',
    styles: ['strong', 'defensive', 'aggressive', 'stamina'],
  },
  {
    id: 'El Comandante',
    description: 'Leader-type player who organizes the team and performs under pressure.',
    styles: ['leader', 'intelligent', 'positioning', 'clutch'],
  },
  {
    id: 'Lockdown',
    description: 'Defensive specialist focused on positioning, strength, and stopping attacks.',
    styles: ['defensive', 'positioning', 'strong', 'aggressive'],
  },
  {
    id: 'Engine',
    description: 'High-work-rate player with stamina, aggression, and constant movement.',
    styles: ['stamina', 'aggressive', 'fast', 'positioning'],
  },
  {
    id: 'Sniper',
    description: 'Finisher who consistently shows goal threat and clutch attacking moments.',
    styles: ['sniper', 'clutch', 'positioning', 'skilled'],
  },
]

const ARCHETYPE_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]))

function normalizeStyleKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function validateStyleSelections(rawStyles, { required = false } = {}) {
  if (rawStyles == null || rawStyles === '') {
    if (required) return { ok: false, error: 'At least one play style is required when accepting a review' }
    return { ok: true, styles: [] }
  }
  if (!Array.isArray(rawStyles)) {
    return { ok: false, error: 'style_selections must be an array' }
  }
  const normalized = rawStyles.map(normalizeStyleKey).filter(Boolean)
  if (required && normalized.length < 1) {
    return { ok: false, error: 'Select at least 1 play style when accepting' }
  }
  if (normalized.length > 3) {
    return { ok: false, error: 'You can select at most 3 play styles' }
  }
  const seen = new Set()
  for (const key of normalized) {
    if (!PLAY_STYLE_KEY_SET.has(key)) {
      return { ok: false, error: `Invalid play style: ${key}` }
    }
    if (seen.has(key)) {
      return { ok: false, error: 'Duplicate play styles are not allowed' }
    }
    seen.add(key)
  }
  return { ok: true, styles: normalized }
}

function extractStyleCountersFromMemberRow(row) {
  const counters = {}
  for (const style of PLAY_STYLES) {
    counters[style.key] = Number(row?.[style.column]) || 0
  }
  return counters
}

function totalStyleVotes(counters) {
  return Object.values(counters).reduce((sum, n) => sum + (Number(n) || 0), 0)
}

function buildRadarFromCounters(counters) {
  const maxCount = Math.max(0, ...Object.values(counters).map((n) => Number(n) || 0))
  const hasData = maxCount > 0
  return PLAY_STYLES.map((style) => {
    const count = Number(counters[style.key]) || 0
    let value = RADAR_MIN_VALUE
    if (hasData) {
      value = Math.round(RADAR_MIN_VALUE + (count / maxCount) * (RADAR_MAX_VALUE - RADAR_MIN_VALUE))
    }
    return { subject: style.label, key: style.key, count, value }
  })
}

function computeMainArchetype(counters) {
  if (totalStyleVotes(counters) <= 0) {
    return { id: 'None', description: null, score: 0 }
  }
  let best = { id: 'None', description: null, score: -1 }
  for (const archetype of ARCHETYPES) {
    const score = archetype.styles.reduce((sum, key) => sum + (Number(counters[key]) || 0), 0)
    if (score > best.score) {
      best = { id: archetype.id, description: archetype.description, score }
    }
  }
  return best
}

function getArchetypeMeta(archetypeId) {
  if (!archetypeId || archetypeId === 'None') {
    return { id: 'None', description: null }
  }
  const found = ARCHETYPE_BY_ID[archetypeId]
  return found ? { id: found.id, description: found.description } : { id: archetypeId, description: null }
}

function buildStyleResponseFromMemberRow(row, mainArchetypeOverride = null) {
  const style_counters = extractStyleCountersFromMemberRow(row)
  const hasStyleData = totalStyleVotes(style_counters) > 0
  const computed = computeMainArchetype(style_counters)
  const archetypeId = mainArchetypeOverride || row?.main_archetype || computed.id || 'None'
  const meta = getArchetypeMeta(archetypeId === 'None' && hasStyleData ? computed.id : archetypeId)
  return {
    style_counters,
    style_radar: buildRadarFromCounters(style_counters),
    has_style_data: hasStyleData,
    main_archetype: hasStyleData || archetypeId !== 'None' ? meta.id : 'None',
    archetype_description: meta.description,
  }
}

const LM_STYLE_COLUMNS_SQL = PLAY_STYLES.map((s) => `lm.${s.column}`).join(',\n              ')

module.exports = {
  PLAY_STYLES,
  PLAY_STYLE_KEYS,
  PLAY_STYLE_KEY_SET,
  KEY_TO_COLUMN,
  COLUMN_TO_KEY,
  LABEL_BY_KEY,
  ARCHETYPES,
  ARCHETYPE_BY_ID,
  RADAR_MIN_VALUE,
  RADAR_MAX_VALUE,
  LM_STYLE_COLUMNS_SQL,
  normalizeStyleKey,
  validateStyleSelections,
  extractStyleCountersFromMemberRow,
  totalStyleVotes,
  buildRadarFromCounters,
  computeMainArchetype,
  getArchetypeMeta,
  buildStyleResponseFromMemberRow,
}
