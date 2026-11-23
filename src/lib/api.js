const DEFAULT_BASE = 'http://127.0.0.1:8000'

export const getBaseUrl = () =>
  (localStorage.getItem('bdx-esp32-url') || DEFAULT_BASE).replace(/\/$/, '')

export const saveBaseUrl = value =>
  localStorage.setItem('bdx-esp32-url', value.trim().replace(/\/$/, ''))

export async function fetchDeviceData() {
  const response = await fetch(`${getBaseUrl()}/api/sensors`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`)
  }

  return response.json()
}

export async function fetchDeviceHealth() {
  const response = await fetch(`${getBaseUrl()}/api/health`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`Backend health endpoint returned HTTP ${response.status}`)
  }

  return response.json()
}