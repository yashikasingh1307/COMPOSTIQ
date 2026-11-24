export const fmtDateTime = d => {
  if (!d) return '—'
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}
export const fmtTime = d => (d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—')
export const fmtTick = (d, spanMs) => (spanMs > 86400000 * 1.5 ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: spanMs <= 7200000 ? '2-digit' : undefined }))
export const fmtNum = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d))
export const fmtUptime = s => {
  if (s == null) return '—'
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`
}
export const ago = (d, now = Date.now()) => {
  if (!d) return '—'
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
