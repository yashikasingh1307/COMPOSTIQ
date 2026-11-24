import { num } from '../lib/rules'

// ThingSpeak channel used by the firmware (fields 1-7). Settings page can override both
// values per browser; VITE_* env vars override the defaults at build time.
const ENV = import.meta.env
const API = ENV.VITE_THINGSPEAK_API || 'https://api.thingspeak.com'
const DEFAULT_CHANNEL = ENV.VITE_THINGSPEAK_CHANNEL || '3593912'
const DEFAULT_KEY = ENV.VITE_THINGSPEAK_READ_KEY || '7C3MG4X4AEC60NXA'

export const getChannel = () => localStorage.getItem('bdx-thingspeak-channel') || DEFAULT_CHANNEL
export const getReadKey = () => localStorage.getItem('bdx-thingspeak-readkey') || DEFAULT_KEY

const feedUrl = query => `${API}/channels/${encodeURIComponent(getChannel())}/feeds.json?api_key=${encodeURIComponent(getReadKey())}&${query}`

function toReading(feed) {
  return {
    t: new Date(feed.created_at),
    temperature: num(feed.field1), humidity: num(feed.field2),
    soilMoisture: num(feed.field3), gasValue: num(feed.field4),
    alarmState: feed.field5 == null ? null : Number(feed.field5) === 1,
    pumpState: feed.field6 == null ? null : Number(feed.field6) === 1,
    fanState: feed.field7 == null ? null : Number(feed.field7) === 1,
  }
}

async function load(query, signal) {
  const response = await fetch(feedUrl(query), { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`ThingSpeak returned HTTP ${response.status}`)
  return response.json()
}

export async function getSensorData(signal) {
  const data = await load('results=1', signal)
  const feed = data.feeds?.[0]
  if (!feed) throw new Error('No sensor data available on ThingSpeak')
  return toReading(feed)
}

// Last 24 h of real uploads (the firmware uploads every 30 s, ~2,880 rows).
export async function getHistory(signal) {
  const data = await load('minutes=1440&results=8000', signal)
  return (data.feeds || []).map(toReading).filter(r => !Number.isNaN(r.t.getTime()))
}
