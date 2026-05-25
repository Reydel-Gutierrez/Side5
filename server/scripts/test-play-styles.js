/**
 * Unit checks for play style validation, radar, and archetype scoring.
 * Usage: node scripts/test-play-styles.js
 */
const assert = require('assert')
const {
  validateStyleSelections,
  buildRadarFromCounters,
  computeMainArchetype,
  PLAY_STYLE_KEYS,
} = require('../src/constants/playStyles')

function testValidation() {
  assert.strictEqual(validateStyleSelections(['fast', 'sniper']).ok, true)
  assert.strictEqual(validateStyleSelections(['fast', 'sniper', 'skilled', 'creative']).ok, false)
  assert.strictEqual(validateStyleSelections(['fast', 'fast']).ok, false)
  assert.strictEqual(validateStyleSelections([], { required: true }).ok, false)
  assert.strictEqual(validateStyleSelections(['not-a-style']).ok, false)
  assert.strictEqual(validateStyleSelections([], { required: false }).ok, true)
  const three = validateStyleSelections(['passer', 'dribbler', 'creative'])
  assert.strictEqual(three.ok, true)
  assert.strictEqual(three.styles.length, 3)
}

function testRadar() {
  const empty = buildRadarFromCounters(Object.fromEntries(PLAY_STYLE_KEYS.map((k) => [k, 0])))
  assert.strictEqual(empty.every((p) => p.value === 12), true)
  const radar = buildRadarFromCounters({ fast: 2, sniper: 4, skilled: 1 })
  const fastPoint = radar.find((p) => p.key === 'fast')
  const sniperPoint = radar.find((p) => p.key === 'sniper')
  assert.ok(sniperPoint.value > fastPoint.value)
  assert.ok(sniperPoint.value <= 100)
}

function testArchetype() {
  const none = computeMainArchetype(Object.fromEntries(PLAY_STYLE_KEYS.map((k) => [k, 0])))
  assert.strictEqual(none.id, 'None')
  const sniper = computeMainArchetype({
    sniper: 5,
    clutch: 3,
    positioning: 2,
    skilled: 1,
  })
  assert.strictEqual(sniper.id, 'Sniper')
  const mago = computeMainArchetype({
    creative: 4,
    passer: 4,
    dribbler: 3,
    skilled: 2,
  })
  assert.strictEqual(mago.id, 'Mago')
}

testValidation()
testRadar()
testArchetype()
console.log('All play style unit checks passed.')
