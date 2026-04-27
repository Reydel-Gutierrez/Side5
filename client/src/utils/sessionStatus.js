export function sessionStatusTone(status) {
  if (status === 'locked') return 'green'
  if (status === 'completed') return 'green'
  if (status === 'draft_pending') return 'orange'
  return 'green'
}
