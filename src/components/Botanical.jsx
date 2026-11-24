// Small hand-built SVG illustrations (logo, sprout, compost bin, leaf branch).
export const LeafLogo = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 44V26" stroke="#9fc58f" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 28C14 28 9 21 9 12c9 0 15 5 15 16Z" fill="#8cc07a" />
    <path d="M24 24C24 13 29 6 40 5c1 10-5 18-16 19Z" fill="#b6dba3" />
    <path d="M24 28C15 24 12 18 9 12" stroke="#e8f3dc" strokeWidth="1" opacity=".6" fill="none" />
  </svg>
)
export const Sprout = ({ size = 56 }) => (
  <svg width={size} height={size * 1.05} viewBox="0 0 56 59" aria-hidden="true">
    <path d="M28 56V30" stroke="#6f9a62" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M28 34C16 34 8 26 8 12c14 0 20 8 20 22Z" fill="#6f9f5f" fillOpacity=".85" />
    <path d="M28 28C28 14 35 5 50 4c1 14-8 24-22 24Z" fill="#8dbb78" fillOpacity=".85" />
  </svg>
)
export const CompostBin = () => (
  <svg viewBox="0 0 140 130" width="100%" height="100%" aria-hidden="true">
    <ellipse cx="70" cy="118" rx="50" ry="7" fill="#7a6a4a" opacity=".18" />
    <path d="M30 100c-8-6-12-18-6-30 10 2 16 10 14 22M112 98c9-5 14-16 9-28-10 1-16 9-15 20" fill="#9bbf86" opacity=".65" />
    <path d="M70 52V34" stroke="#5f9055" strokeWidth="3" strokeLinecap="round" />
    <path d="M70 38C58 38 50 30 50 18c13 0 20 8 20 20Z" fill="#6aa05a" />
    <path d="M70 34C70 22 77 12 92 11c1 13-7 22-22 23Z" fill="#8cc07a" />
    <path d="M36 62h68l-4 8H40z" fill="#4a3a2a" />
    <ellipse cx="70" cy="58" rx="33" ry="7" fill="#3f3226" />
    <circle cx="58" cy="57" r="2" fill="#5d4a36" /><circle cx="78" cy="59" r="2.4" fill="#5d4a36" /><circle cx="68" cy="55" r="1.6" fill="#6b563f" />
    <g stroke="#6e5230" strokeWidth=".8">
      <path d="M36 62l4 52h60l4-52z" fill="#b48d58" />
      <path d="M38 78h64M39 94h62" fill="none" />
      <path d="M36 62h68" fill="none" strokeWidth="2.2" stroke="#96703f" />
    </g>
    <path d="M40 66l1.6 20M100 66l-1.6 20" stroke="#a07c4a" strokeWidth="2" opacity=".7" />
  </svg>
)
export const LeafBranch = ({ className = '', flip = false }) => (
  <svg className={className} viewBox="0 0 120 160" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M60 158C58 110 66 60 96 8" stroke="#6b8d5e" strokeWidth="2" fill="none" opacity=".7" />
    {[[62, 128, -40, 40], [64, 104, 30, 44], [70, 82, -45, 42], [76, 60, 32, 40], [86, 36, -40, 34], [94, 16, 40, 30]].map(([x, y, r, l], i) => (
      <path key={i} transform={`translate(${x} ${y}) rotate(${r - 90})`} d={`M0 0C${l * .3} ${-l * .42} ${l * .75} ${-l * .36} ${l} 0 C${l * .75} ${l * .36} ${l * .3} ${l * .42} 0 0Z`} fill={i % 2 ? '#8fb07f' : '#6f9564'} fillOpacity=".7" stroke="#4d7a4d" strokeOpacity=".3" />
    ))}
  </svg>
)
