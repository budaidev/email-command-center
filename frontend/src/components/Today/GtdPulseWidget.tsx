import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { api } from '../../api/client'
import { ScoreRing, scoreLabel } from '../Pulse/ScoreRing'

export function GtdPulseWidget() {
  const navigate = useNavigate()
  const { data: pulse } = useQuery({
    queryKey: ['tasks', 'health'],
    queryFn: api.getGtdHealth,
    refetchInterval: 60_000,
  })

  if (!pulse) return null

  const countBuckets = [
    { label: 'Inbox', v: pulse.counts.inbox, hint: 'to process', tone: 'var(--text-3)' },
    { label: 'Next', v: pulse.counts.next, hint: 'ready to do', tone: 'var(--accent)' },
    { label: 'Waiting', v: pulse.counts.wait, hint: 'blocked', tone: 'var(--warn)' },
    { label: 'Someday', v: pulse.counts.some, hint: 'parking lot', tone: 'var(--violet)' },
  ]

  return (
    <div style={{
      padding: 24,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      gap: 28,
      alignItems: 'center',
    }}>
      {/* Score ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <ScoreRing score={pulse.score} trend={pulse.trend} size={96} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>{scoreLabel(pulse.score)}</div>
        </div>
      </div>

      {/* Right side */}
      <div>
        {/* Counts */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          marginBottom: 20, paddingBottom: 18,
          borderBottom: '1px dashed var(--line-soft)',
        }}>
          {countBuckets.map((b, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 500, color: b.tone, letterSpacing: '-0.02em', lineHeight: 1 }}>{b.v}</span>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{b.label}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>{b.hint}</div>
            </div>
          ))}
        </div>

        {/* Signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pulse.warnings.map((w, i) => (
            <Signal key={'w' + i} kind="warn" text={w.text} />
          ))}
          {pulse.praise.map((p, i) => (
            <Signal key={'p' + i} kind="ok" text={p.text} />
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={() => navigate('/pulse')}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <CheckCircle size={12} />
            Process inbox · {pulse.counts.inbox}
          </button>
          <button
            onClick={() => navigate('/pulse')}
            style={{
              padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 7,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            Open Pulse <ChevronRight size={12} />
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-4)', alignSelf: 'center' }}>
            {pulse.processedThisWeek} completed this week
          </span>
        </div>
      </div>
    </div>
  )
}

function Signal({ kind, text }: { kind: 'warn' | 'ok'; text: string }) {
  const color = kind === 'warn' ? 'var(--warn)' : 'var(--ok)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4,
    }}>
      <span style={{
        width: 14, height: 14, flexShrink: 0, borderRadius: 7,
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        color, fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{kind === 'warn' ? '!' : '✓'}</span>
      <span>{text}</span>
    </div>
  )
}
