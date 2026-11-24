import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import { fmtTick } from './format'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export const SERIES = {
  temperature: { label: 'Temperature (°C)', short: 'Temperature', unit: '°C', color: '#2f6b3a', axis: 'y', d: 1 },
  humidity: { label: 'Humidity (%)', short: 'Humidity', unit: '%', color: '#5b8fd0', axis: 'y', d: 0 },
  soilMoisture: { label: 'Soil Moisture (ADC)', short: 'Soil moisture', unit: 'ADC', color: '#a8c770', axis: 'y1', d: 0 },
  gasValue: { label: 'Gas Level (ADC)', short: 'Gas level', unit: 'ADC', color: '#e3a92b', axis: 'y1', d: 0 },
}
export const RANGES = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000 }

// Averages real samples into <= ~90 buckets. Gaps (device offline) become breaks, not straight lines.
export function buildSeries(history, rangeMs, now, keys) {
  const from = now - rangeMs, rows = history.filter(r => r.t.getTime() >= from)
  if (!rows.length) return null
  const size = Math.max(30000, Math.round(rangeMs / 90)), map = new Map()
  for (const r of rows) {
    const b = Math.floor(r.t.getTime() / size), e = map.get(b) || { n: 0, sum: {} }
    e.n++; keys.forEach(k => { if (r[k] != null) (e.sum[k] ||= []).push(r[k]) }); map.set(b, e)
  }
  const buckets = [...map.entries()].sort((a, b) => a[0] - b[0])
  const labels = [], data = Object.fromEntries(keys.map(k => [k, []])), times = []
  let last = null
  for (const [b, e] of buckets) {
    const t = b * size + size / 2
    if (last != null && t - last > Math.max(size * 3, 600000)) { labels.push(''); times.push(null); keys.forEach(k => data[k].push(null)) }
    labels.push(fmtTick(new Date(t), rangeMs)); times.push(t)
    keys.forEach(k => { const a = e.sum[k]; data[k].push(a ? a.reduce((x, y) => x + y, 0) / a.length : null) })
    last = t
  }
  return { labels, data, times }
}

export function chartOptions({ dual, rangeMs, compact }) {
  const grid = { color: 'rgba(36,76,54,.09)' }, ticks = { color: '#637461', font: { family: 'Lora', size: compact ? 10 : 11 } }
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(25,63,44,.94)', padding: 10, cornerRadius: 10, titleFont: { family: 'Lora' }, bodyFont: { family: 'Lora' },
        callbacks: { title: items => { const t = items[0]?.chart.$times?.[items[0].dataIndex]; return t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '' } },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { ...ticks, maxTicksLimit: compact ? 5 : 7, maxRotation: 0 }, border: { color: 'rgba(36,76,54,.25)' } },
      y: { position: 'left', grid, ticks, border: { display: false }, ...(dual ? { min: 0, suggestedMax: 100 } : {}) },
      ...(dual ? { y1: { position: 'right', grid: { display: false }, ticks, border: { display: false }, min: 0, suggestedMax: 4095, title: { display: false } } } : {}),
    },
    elements: { line: { tension: 0.35, borderWidth: 2.2 }, point: { radius: 0, hitRadius: 10, hoverRadius: 4 } },
  }
}
