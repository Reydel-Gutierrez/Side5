function apiBaseUrl() {
  const base = String(import.meta.env.VITE_API_URL || '').trim()
  return base.replace(/\/$/, '')
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const base = apiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalized}` : normalized
}

/** Append cache-buster on GET so leaderboard/profile always reflect latest DB rows. */
function withCacheBuster(url, method) {
  if ((method || 'GET').toUpperCase() !== 'GET') return url
  if (url.includes('_=')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}_=${Date.now()}`
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const url = withCacheBuster(buildUrl(path), method)

  let response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch (networkError) {
    const base = apiBaseUrl()
    const hint = base
      ? `Cannot reach API at ${base}. Check VITE_API_URL in client/.env and that the server is running.`
      : 'Cannot reach API. Start the server (npm run dev in /server) on port 5000, then restart Vite.'
    throw new Error(hint, { cause: networkError })
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      (response.status === 404
        ? `API not found (${path}). Start the API server (port 5000) and restart it after pulling latest changes.`
        : `Request failed (${response.status})`)
    throw new Error(message)
  }

  return payload
}
