const DEFAULT_BASE = 'http://127.0.0.1:8000'

export const getBaseUrl = () =>
  (localStorage.getItem('bdx-esp32-url') || DEFAULT_BASE).replace(/\/$/, '')

export const saveBaseUrl = value =>
  localStorage.setItem('bdx-esp32-url', value.trim().replace(/\/$/, ''))

async function fetchJson(path, signal) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    signal,
    cache: 'no-store'
  })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).detail || '' } catch { /* use status text */ }
    throw new Error(detail || `Backend returned HTTP ${response.status}`)
  }
  return response.json()
}

export function fetchDeviceData(signal) {
  return fetchJson('/api/sensors', signal)
}

export function fetchDeviceHealth(signal) {
  return fetchJson('/api/health', signal)
}

export async function fetchDeviceHistory(minutes = 1440, signal) {
  const query = new URLSearchParams({ minutes: String(minutes) })
  return fetchJson(`/api/history?${query}`, signal)
}

export async function sendDeviceControl(command, signal) {
  const response = await fetch(`${getBaseUrl()}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal,
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || `Control failed (HTTP ${response.status})`)
  return payload
}
