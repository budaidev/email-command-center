interface Props {
  score: number
  trend: number
  size?: number
}

export function scoreColor(score: number) {
  if (score >= 80) return 'var(--ok)'
  if (score >= 60) return 'var(--accent)'
  if (score >= 40) return 'var(--warn)'
  return 'var(--danger)'
}

export function scoreLabel(score: number) {
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Holding steady'
  if (score >= 40) return 'Needs attention'
  return 'Overloaded'
}

export function ScoreRing({ score, trend, size = 96 }: Props) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const c = 2 * Math.PI * r
  const dash = c * (score / 100)
  const color = scoreColor(score)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={size > 100 ? 8 : 6} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={size > 100 ? 8 : 6}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
        }}
      >
        <div style={{ fontSize: size > 100 ? 40 : 26, fontWeight: 500, letterSpacing: '-0.03em', color, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-4)', letterSpacing: '0.08em' }}>/ 100</div>
        <div style={{ fontSize: 10.5, color: trend >= 0 ? 'var(--ok)' : 'var(--warn)', marginTop: 4, fontWeight: 500 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} vs last wk
        </div>
      </div>
    </div>
  )
}
