import { fetchDeviceData } from '../lib/api'

export async function getSensorData() {
  return fetchDeviceData()
}
