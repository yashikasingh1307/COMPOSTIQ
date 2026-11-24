import { fetchDeviceData, fetchDeviceHistory } from '../lib/api'

export function getSensorData(signal) {
  return fetchDeviceData(signal)
}

export async function getSensorHistory(minutes = 1440, signal) {
  const payload = await fetchDeviceHistory(minutes, signal)
  return Array.isArray(payload?.readings) ? payload.readings : []
}
