import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSensorData, getSensorHistory } from '../services/api'
import { fetchDeviceHealth } from '../lib/api'
import { evaluateAlerts, estimateHealthScore } from '../lib/rules'
import { deriveEpisodes, deriveEvents } from '../lib/events'

const LATEST_MS = 15000
const HISTORY_MS = 60000
const STALE_MS = 5 * 60 * 1000

function normalizeReading(row) {
  const t = new Date(row?.lastUpdate)
  if (Number.isNaN(t.getTime())) return null
  return {
    ...row,
    t,
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    soilMoisture: Number(row.soilMoisture),
    gasValue: Number(row.gasValue),
    alarmState: row.alarmState == null ? null : Boolean(row.alarmState),
    pumpState: row.pumpState == null ? null : Boolean(row.pumpState),
    fanState: row.fanState == null ? null : Boolean(row.fanState),
  }
}

export function useCompostData() {
  const [reading, setReading] = useState(null)
  const [health, setHealth] = useState(null)
  const [history, setHistory] = useState([])
  const [historyState, setHistoryState] = useState('loading')
  const [errors, setErrors] = useState({ backend: null, history: null })
  const [session, setSession] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [triedLatest, setTriedLatest] = useState(false)
  const controllers = useRef({ latest: null, history: null })
  const previous = useRef(null)
  const historyLoaded = useRef(false)

  const pollLatest = useCallback(async () => {
    controllers.current.latest?.abort()
    const controller = new AbortController()
    controllers.current.latest = controller
    try {
      const row = normalizeReading(await getSensorData(controller.signal))
      if (!row) throw new Error('Backend returned an invalid sensor timestamp.')
      if (!controller.signal.aborted) {
        setReading(row)
        setErrors(current => ({ ...current, backend: null }))
      }
    } catch (error) {
      if (!controller.signal.aborted) setErrors(current => ({ ...current, backend: error.message }))
    } finally {
      if (!controller.signal.aborted) setTriedLatest(true)
    }
  }, [])

  const pollHealth = useCallback(async signal => {
    try {
      setHealth(await fetchDeviceHealth(signal))
    } catch {
      if (!signal?.aborted) setHealth(null)
    }
  }, [])

  const pollHistory = useCallback(async () => {
    controllers.current.history?.abort()
    const controller = new AbortController()
    controllers.current.history = controller
    try {
      const rows = (await getSensorHistory(1440, controller.signal))
        .map(normalizeReading).filter(Boolean).sort((a, b) => a.t - b.t)
      if (!controller.signal.aborted) {
        setHistory(rows)
        historyLoaded.current = true
        setHistoryState('ok')
        setErrors(current => ({ ...current, history: null }))
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrors(current => ({ ...current, history: error.message }))
        setHistoryState(historyLoaded.current ? 'ok' : 'error')
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const healthController = new AbortController()
    await Promise.allSettled([pollLatest(), pollHealth(healthController.signal), pollHistory()])
    setRefreshing(false)
  }, [pollLatest, pollHealth, pollHistory])

  useEffect(() => {
    const healthController = new AbortController()
    pollLatest()
    pollHealth(healthController.signal)
    pollHistory()
    const latestTimer = setInterval(() => { if (!document.hidden) pollLatest() }, LATEST_MS)
    const historyTimer = setInterval(() => { if (!document.hidden) pollHistory() }, HISTORY_MS)
    const tickTimer = setInterval(() => setNow(Date.now()), 5000)
    const onVisibility = () => {
      if (!document.hidden) {
        pollLatest()
        pollHealth(healthController.signal)
        pollHistory()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(latestTimer)
      clearInterval(historyTimer)
      clearInterval(tickTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      healthController.abort()
      controllers.current.latest?.abort()
      controllers.current.history?.abort()
    }
  }, [pollLatest, pollHealth, pollHistory])

  const age = reading ? now - reading.t.getTime() : null
  const state = !reading ? (triedLatest ? 'offline' : 'loading') : age > STALE_MS ? 'stale' : reading.source === 'esp32' ? 'live' : 'cloud'
  const source = reading?.source ?? null

  const alerts = useMemo(() => {
    if (!reading || state === 'stale') return []
    const list = evaluateAlerts(reading)
    if (reading.alarmState && list.length === 0 && reading.alertMessage && reading.alertMessage !== 'All systems normal') {
      list.push({ id: 'device', sensor: 'Device', severity: 'warning', message: reading.alertMessage, action: '' })
    }
    return list
  }, [reading, state])

  const score = useMemo(() => {
    if (!reading) return null
    const calculated = estimateHealthScore(reading)
    const value = reading.healthScore ?? calculated?.total
    return value == null ? null : { value, source: 'estimated' }
  }, [reading])

  const connectivity = useMemo(() => {
    const fresh = age != null && age <= STALE_MS
    return {
      wifi: 'unknown', wifiNote: 'Wi-Fi status is not exposed by FastAPI',
      mqtt: 'unknown', mqttNote: 'MQTT status is not exposed by FastAPI',
      thingspeak: fresh && !errors.backend && reading?.source !== 'esp32' ? 'connected' : errors.backend ? 'disconnected' : 'unknown',
      thingspeakNote: reading?.source === 'esp32' ? 'Latest sensor and actuator state is live from ESP32 through FastAPI' : fresh ? 'Latest sample received through FastAPI' : 'Waiting for a recent sample',
      uptime: null,
    }
  }, [age, errors.backend, reading?.source])

  const sampleStamp = reading?.t?.getTime()
  useEffect(() => {
    if (!reading) return
    const p = previous.current
    const added = []
    if (p) {
      if (p.alarm != null && reading.alarmState != null && p.alarm !== reading.alarmState) added.push({ t: reading.t, type: reading.alarmState ? 'alert' : 'ok', text: reading.alarmState ? `Alert: ${reading.alertMessage}` : 'Alert resolved', origin: 'live' })
      if (p.pump != null && reading.pumpState != null && p.pump !== reading.pumpState) added.push({ t: reading.t, type: 'pump', text: `Pump ${reading.pumpState ? 'activated' : 'stopped'}`, origin: 'live' })
      if (p.fan != null && reading.fanState != null && p.fan !== reading.fanState) added.push({ t: reading.t, type: 'fan', text: `Fan ${reading.fanState ? 'activated' : 'stopped'}`, origin: 'live' })
    }
    previous.current = { alarm: reading.alarmState, pump: reading.pumpState, fan: reading.fanState }
    if (added.length) setSession(old => [...added, ...old].slice(0, 60))
  }, [sampleStamp]) // readings arrive at the ThingSpeak update cadence

  const activity = useMemo(() => {
    const merged = [...session, ...deriveEvents(history)].sort((a, b) => b.t - a.t)
    return merged.slice(0, 80)
  }, [session, history])
  const episodes = useMemo(() => deriveEpisodes(history), [history])

  return {
    reading, source, state, lastUpdated: reading?.t ?? null, score, alerts,
    connectivity, activity, episodes, history, historyState,
    historyError: errors.history, errors, health, refreshing, refresh, now,
  }
}
