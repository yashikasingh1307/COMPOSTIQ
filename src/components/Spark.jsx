// Tiny trend line drawn from real recent samples. Renders nothing without data.
export default function Spark({ values }) {
  const v = (values || []).filter(x => x != null)
  if (v.length < 4) return <div className="spark spark-none" aria-hidden="true" />
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1, w = 200, h = 24
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * w},${h - 3 - ((y - min) / span) * (h - 6)}`)
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts.join(' ')} fill="none" stroke="#6f9a62" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
export function recent(history, key, now, ms = 3600000, n = 40) {
  const rows = history.filter(r => r.t.getTime() >= now - ms)
  const step = Math.max(1, Math.floor(rows.length / n))
  return rows.filter((_, i) => i % step === 0).map(r => r[key])
}
