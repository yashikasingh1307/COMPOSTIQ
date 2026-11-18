const DEFAULT_BASE = 'http://192.168.4.1'
export const getBaseUrl = () => (localStorage.getItem('bdx-esp32-url') || DEFAULT_BASE).replace(/\/$/, '')
export const saveBaseUrl = value => localStorage.setItem('bdx-esp32-url', value.trim().replace(/\/$/, ''))

export async function fetchDeviceData() {
  const response = await fetch(`${getBaseUrl()}/data`, { signal: AbortSignal.timeout(4500), cache: 'no-store' })
  if (!response.ok) throw new Error(`ESP32 returned HTTP ${response.status}`)
  return response.json()
}
export async function fetchDeviceHealth() {
  const response = await fetch(`${getBaseUrl()}/health`, { signal: AbortSignal.timeout(4500), cache: 'no-store' })
  if (!response.ok) throw new Error(`ESP32 health endpoint returned HTTP ${response.status}`)
  return response.json()
}
