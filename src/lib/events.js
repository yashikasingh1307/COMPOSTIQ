import { evaluateAlerts } from './rules'

const GAP_MS = 5 * 60 * 1000

// Events reconstructed from real ThingSpeak uploads (30 s resolution: short pump pulses
// between two uploads can be missed).
export function deriveEvents(rows) {
  const ev = []
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i], t = b.t
    if (b.t - a.t > GAP_MS) ev.push({ t: a.t, type: 'gap', text: `No data for ${Math.round((b.t - a.t) / 60000)} min`, origin: 'cloud' })
    if (a.alarmState === false && b.alarmState) ev.push({ t, type: 'alert', text: 'Alert generated', origin: 'cloud' })
    if (a.alarmState && b.alarmState === false) ev.push({ t, type: 'ok', text: 'Conditions returned to normal', origin: 'cloud' })
    if (a.pumpState === false && b.pumpState) ev.push({ t, type: 'pump', text: 'Pump activated', origin: 'cloud' })
    if (a.fanState === false && b.fanState) ev.push({ t, type: 'fan', text: 'Fan activated', origin: 'cloud' })
  }
  return ev
}

export function deriveEpisodes(rows) {
  const open = new Map(), done = []
  const meta = {}
  for (const r of rows) {
    const now = evaluateAlerts(r)
    const ids = new Set(now.map(a => a.id))
    now.forEach(a => { meta[a.id] = a; if (!open.has(a.id)) open.set(a.id, r.t) })
    for (const [id, start] of open) if (!ids.has(id)) { done.push({ ...meta[id], start, end: r.t }); open.delete(id) }
  }
  const active = [...open].map(([id, start]) => ({ ...meta[id], start, end: null }))
  return [...active, ...done].sort((x, y) => y.start - x.start)
}
