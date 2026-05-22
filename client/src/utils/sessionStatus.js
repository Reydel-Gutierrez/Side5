export function sessionStatusTone(status) {
  if (status === 'locked') return 'green'
  if (status === 'completed' || status === 'past') return 'green'
  if (status === 'draft_pending') return 'orange'
  return 'green'
}
