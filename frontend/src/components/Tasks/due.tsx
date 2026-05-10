import { Clock } from 'lucide-react'

export interface DueInfo {
  label: string
  tone: 'danger' | 'accent' | 'warn' | 'neutral'
}

export function parseDue(d: string | null): DueInfo | null {
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dt = new Date(d + 'T00:00:00')
  const diff = Math.round((dt.getTime() - today.getTime()) / 86400000)

  let label: string
  let tone: DueInfo['tone']

  if (diff < 0) {
    label = `${-diff}d overdue`
    tone = 'danger'
  } else if (diff === 0) {
    label = 'Today'
    tone = 'accent'
  } else if (diff === 1) {
    label = 'Tomorrow'
    tone = 'warn'
  } else if (diff < 7) {
    label = `in ${diff}d`
    tone = 'neutral'
  } else {
    label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    tone = 'neutral'
  }

  return { label, tone }
}

export function relDate(d: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dt = new Date(d + 'T00:00:00')
  const diff = Math.round((today.getTime() - dt.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

const toneStyles: Record<DueInfo['tone'], { bg: string; fg: string }> = {
  danger: { bg: 'color-mix(in oklch, var(--danger) 14%, transparent)', fg: 'var(--danger)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  warn: { bg: 'color-mix(in oklch, var(--warn) 14%, transparent)', fg: 'var(--warn)' },
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
}

export function DueChip({ info }: { info: DueInfo | null }) {
  if (!info) return null
  const s = toneStyles[info.tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '-0.01em',
      }}
    >
      <Clock size={10} />
      {info.label}
    </span>
  )
}
