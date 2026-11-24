// Generates the botanical watercolor background (SVG). Render with scripts/render-background.py
// to produce the optimised raster used by the app. Deterministic: same output on every run.
import { writeFileSync } from 'node:fs'
let s = 7
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
const W = 1672, H = 941
const greens = ['#7fa070', '#8fb07f', '#6f9564', '#9bb98a', '#a9c29a', '#5f8a5a', '#b4c9a2']

const leaf = (x, y, ang, L, Wd, c, op = 0.62) => {
  const p = `M0,0 C${L * .22},${-Wd} ${L * .68},${-Wd * .85} ${L},0 C${L * .68},${Wd * .85} ${L * .22},${Wd} 0,0Z`
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})" filter="url(#wc)">
  <path d="${p}" fill="${c}" fill-opacity="${op}" stroke="#4d7a4d" stroke-opacity=".28" stroke-width="1.2"/>
  <path d="M0,0 Q${L * .5},${-Wd * .08} ${L * .94},0" stroke="#e9efd9" stroke-opacity=".55" stroke-width="1.1" fill="none"/></g>`
}
const branch = (x, y, ang, len, n, bend, size = 1, op = .62) => {
  const a = ang * Math.PI / 180, ex = x + Math.cos(a + bend) * len, ey = y + Math.sin(a + bend) * len
  const cx = x + Math.cos(a) * len * .55, cy = y + Math.sin(a) * len * .55
  let out = `<path d="M${x},${y} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" stroke="#6b8d5e" stroke-opacity=".55" stroke-width="2.2" fill="none" stroke-linecap="round" filter="url(#wc)"/>`
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1), u = 1 - t
    const px = u * u * x + 2 * u * t * cx + t * t * ex, py = u * u * y + 2 * u * t * cy + t * t * ey
    const tx = 2 * u * (cx - x) + 2 * t * (ex - cx), ty = 2 * u * (cy - y) + 2 * t * (ey - cy)
    const base = Math.atan2(ty, tx) * 180 / Math.PI, side = i % 2 ? 1 : -1, k = (1.05 - t * .45) * size
    out += leaf(px, py, base + side * (42 + rnd() * 18), (62 + rnd() * 26) * k, (17 + rnd() * 7) * k, greens[Math.floor(rnd() * greens.length)], op)
  }
  out += leaf(ex, ey, Math.atan2(ey - cy, ex - cx) * 180 / Math.PI, 58 * size, 16 * size, greens[2], op)
  return out
}
const dots = (x0, y0, cols, rows, dx, dy, r = 3.2) => {
  let o = ''
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) o += `<circle cx="${x0 + i * dx}" cy="${y0 + j * dy}" r="${r}" fill="#7da072" fill-opacity=".5"/>`
  return o
}
const wash = (cx, cy, rx, ry, c, o) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}" fill-opacity="${o}" filter="url(#wash)"/>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
 <filter id="wc" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/><feGaussianBlur stdDeviation=".5"/></filter>
 <filter id="wash" x="-40%" y="-40%" width="180%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="3" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="140"/><feGaussianBlur stdDeviation="38"/></filter>
 <filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="2" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 .45  0 0 0 0 .42  0 0 0 0 .32  0 0 0 .5 -.1"/></filter>
 <filter id="fiber" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".03 .09" numOctaves="2" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .38  0 0 0 .55 -.14"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="#f7f5ea"/>
${wash(260, 180, 420, 300, '#b9cba9', .2)}${wash(1010, 520, 520, 260, '#c9d9b8', .16)}${wash(1560, 820, 380, 240, '#a9bd98', .26)}
${wash(120, 820, 300, 300, '#a9bd98', .3)}${wash(1400, 80, 380, 200, '#bccfac', .22)}${wash(700, 940, 420, 150, '#c3d4b2', .16)}
${branch(1120, -10, 70, 150, 4, .25, 1.05)}${branch(1245, -14, 105, 130, 3, -.1, .9, .5)}
${branch(1672, 20, 168, 190, 5, .3, 1.15)}${branch(1672, 215, 200, 150, 4, -.2, 1, .55)}${branch(1672, 560, 190, 120, 3, .2, .9, .5)}
${branch(1672, 770, 205, 230, 5, -.25, 1.2)}${branch(1380, 960, 285, 190, 4, .2, 1.05, .55)}${branch(1100, 960, 255, 90, 2, .2, .8, .4)}
${branch(40, 940, 292, 330, 6, .18, 1.15, .6)}${branch(140, 960, 270, 220, 4, -.2, 1, .5)}${branch(20, 120, 20, 110, 3, .3, .9, .45)}
${dots(975, 26, 4, 5, 33, 17)}${dots(1540, 702, 5, 4, 24, 20, 2.6)}${dots(1108, 918, 6, 1, 23, 0, 3)}${dots(1630, 900, 2, 2, 20, 18, 2.4)}
<rect width="${W}" height="${H}" filter="url(#paper)" opacity=".4" style="mix-blend-mode:multiply"/>
<rect width="${W}" height="${H}" filter="url(#fiber)" opacity=".16"/>
</svg>`
writeFileSync(new URL('../src/assets/botanical-background.svg', import.meta.url), svg)
console.log('wrote', svg.length, 'bytes')
