/** Coerce to a finite number; NaN and non-finite values become fallback. */
export function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
