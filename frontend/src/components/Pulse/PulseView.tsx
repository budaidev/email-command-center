import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  Inbox,
  Clock,
  Sparkles,
  Users,
  Focus,
  ChevronRight,
} from 'lucide-react'
import { api } from '../../api/client'
import type { GtdHealth } from '../../api/client'
import { ScoreRing, scoreColor, scoreLabel } from './ScoreRing'
import { ProcessInboxMode } from './ProcessInboxMode'
import { StaleSweep } from './StaleSweep'
import { SharpenVague } from './SharpenVague'
import { NudgeWaitingFor } from './NudgeWaitingFor'
import { WeeklyReviewWizard } from './WeeklyReviewWizard'

type Flow = 'review' | 'process' | 'stale' | 'sharpen' | 'nudge' | null

export function PulseView() {
  const navigate = useNavigate()
  const [flow, setFlow] = useState<Flow>(null)

  const { data: pulse, isLoading } = useQuery({
    queryKey: ['tasks', 'health'],
    queryFn: api.getGtdHealth,
    refetchInterval: 60_000,
  })

  if (isLoading || !pulse) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        Loading pulse...
      </div>
    )
  }

  const color = scoreColor(pulse.score)
  const label = scoreLabel(pulse.score)

  const signalFix = (text: string): { kind: Flow; label: string } | null => {
    const t = text.toLowerCase()
    if (t.includes('inbox')) return { kind: 'process', label: 'Process inbox' }
    if (t.includes('stale')) return { kind: 'stale', label: 'Sweep stale' }
    if (t.includes('waiting') || t.includes('nudge')) return { kind: 'nudge', label: 'Review nudges' }
    return null
  }

  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 56px 96px' }}>

        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-3)', marginBottom: 16,
          }}
        >
          <ArrowLeft size={12} /> Back to Today
        </button>

        {/* Masthead */}
        <header>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--text-3)', marginBottom: 10,
          }}>
            GTD Pulse · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em',
            lineHeight: 1.05, maxWidth: 760,
          }}>
            <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--text-2)' }}>
              Your system is{' '}
            </span>
            <span style={{ color }}>{label.toLowerCase()}</span>.
          </h1>

          <div style={{
            marginTop: 28, display: 'grid', gridTemplateColumns: '160px 1fr',
            gap: 32, paddingTop: 24, borderTop: '1px solid var(--line)',
          }}>
            <ScoreRing score={pulse.score} trend={pulse.trend} size={140} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignContent: 'center' }}>
              <MiniStat k="Processed" v={String(pulse.processedThisWeek)} hint="this week" accent="var(--ok)" />
              <MiniStat k="Inbox" v={String(pulse.counts.inbox)} hint="to process" />
              <MiniStat k="Next" v={String(pulse.counts.next)} hint="ready to do" accent="var(--accent)" />
              <MiniStat k="Waiting" v={String(pulse.counts.wait)} hint="blocked" accent="var(--warn)" />
            </div>
          </div>
        </header>

        {/* Signals */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Signals" title="What needs your attention" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {pulse.warnings.map((w, i) => {
              const fix = signalFix(w.text)
              return (
                <SignalCard key={'w' + i} kind="warn" text={w.text}
                  fixLabel={fix?.label} onFix={fix ? () => setFlow(fix.kind) : undefined} />
              )
            })}
            {pulse.praise.map((p, i) => (
              <SignalCard key={'p' + i} kind="ok" text={p.text} />
            ))}
          </div>
        </section>

        {/* Buckets */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Buckets" title="Flow of work" />
          <BucketFlow pulse={pulse} onOpenInbox={() => setFlow('process')} />
        </section>

        {/* Improvement flows */}
        <section style={{ marginTop: 40 }}>
          <SectionKicker kicker="Improvement" title="Sharpen your system" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <FlowCard
              icon={<CheckCircle size={15} />} tone="ok"
              title="Weekly Review"
              desc="The canonical GTD ritual. 5 steps, guided."
              cta="Start review" onClick={() => setFlow('review')}
            />
            <FlowCard
              icon={<Inbox size={15} />} tone="accent"
              title="Process Inbox" badge={`${pulse.counts.inbox} items`}
              desc="One at a time. Y/W/S/D/X keyboard."
              cta="Enter zero mode" onClick={() => setFlow('process')}
            />
            <FlowCard
              icon={<Clock size={15} />} tone="warn"
              title="Stale Sweep" badge={`${pulse.stale.length} items`}
              desc="Untouched > 14 days. Demote or sharpen."
              cta="Sweep now" onClick={() => setFlow('stale')}
            />
            <FlowCard
              icon={<Sparkles size={15} />} tone="ai"
              title="Sharpen Vague" badge="AI"
              desc="Rewrite vague task titles as concrete actions."
              cta="Open wizard" onClick={() => setFlow('sharpen')}
            />
            <FlowCard
              icon={<Users size={15} />} tone="violet"
              title="Nudge Waiting-For" badge={`${pulse.waitingFor.length} people`}
              desc="Follow up on things you're blocked on."
              cta="Review nudges" onClick={() => setFlow('nudge')}
            />
            <FlowCard
              icon={<Focus size={15} />} tone="muted"
              title="Focus mode" badge="Coming soon"
              desc="25-min timer, Next list only, silence everything."
              cta="Not yet" disabled
            />
          </div>
        </section>
      </div>

      {/* Flow overlays */}
      {flow === 'review' && <WeeklyReviewWizard pulse={pulse} onClose={() => setFlow(null)} />}
      {flow === 'process' && <ProcessInboxMode pulse={pulse} onClose={() => setFlow(null)} />}
      {flow === 'stale' && <StaleSweep pulse={pulse} onClose={() => setFlow(null)} />}
      {flow === 'sharpen' && <SharpenVague onClose={() => setFlow(null)} />}
      {flow === 'nudge' && <NudgeWaitingFor pulse={pulse} onClose={() => setFlow(null)} />}
    </div>
  )
}

/* ---------- Sub-components ---------- */

function SectionKicker({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
        {kicker}
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>{title}</h2>
    </div>
  )
}

function MiniStat({ k, v, hint, accent }: { k: string; v: string; hint: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{k}</div>
      <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: accent || 'var(--text)', lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>{hint}</div>
    </div>
  )
}

function SignalCard({ kind, text, fixLabel, onFix }: { kind: 'warn' | 'ok'; text: string; fixLabel?: string; onFix?: () => void }) {
  const color = kind === 'warn' ? 'var(--warn)' : 'var(--ok)'
  return (
    <div style={{
      padding: 14, background: 'var(--surface)',
      border: '1px solid var(--line-soft)', borderRadius: 10,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: 12,
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        color, fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>{kind === 'warn' ? '!' : '✓'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
        {fixLabel && onFix && (
          <button onClick={onFix} style={{
            marginTop: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 500,
            background: `color-mix(in oklch, ${color} 14%, transparent)`,
            color, border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
            borderRadius: 6,
          }}>{fixLabel} →</button>
        )}
      </div>
    </div>
  )
}

function BucketFlow({ pulse, onOpenInbox }: { pulse: GtdHealth; onOpenInbox: () => void }) {
  const buckets = [
    { id: 'inbox', label: 'Inbox', v: pulse.counts.inbox, hint: 'to process', tone: 'var(--text-3)', onClick: onOpenInbox },
    { id: 'next', label: 'Next', v: pulse.counts.next, hint: 'ready to do', tone: 'var(--accent)' },
    { id: 'wait', label: 'Waiting', v: pulse.counts.wait, hint: 'blocked', tone: 'var(--warn)' },
    { id: 'some', label: 'Someday', v: pulse.counts.some, hint: 'parking lot', tone: 'var(--violet)' },
    { id: 'done', label: 'Completed', v: pulse.processedThisWeek, hint: 'this wk', tone: 'var(--ok)' },
  ]
  return (
    <div style={{
      padding: 20, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 14,
      display: 'flex', alignItems: 'stretch', gap: 0,
    }}>
      {buckets.map((b, i) => (
        <div key={b.id} style={{ display: 'contents' }}>
          <button onClick={b.onClick} style={{
            flex: 1, padding: '4px 8px', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
            textAlign: 'left', cursor: b.onClick ? 'pointer' : 'default',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{b.label}</div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', color: b.tone, lineHeight: 1 }}>{b.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{b.hint}</div>
          </button>
          {i < buckets.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-4)', paddingTop: 28 }}>
              <ChevronRight size={14} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FlowCard({ icon, title, badge, desc, cta, tone = 'accent', onClick, disabled }: {
  icon: React.ReactNode; title: string; badge?: string; desc: string; cta: string;
  tone?: string; onClick?: () => void; disabled?: boolean;
}) {
  const toneMap: Record<string, string> = {
    accent: 'var(--accent)', ok: 'var(--ok)', warn: 'var(--warn)',
    ai: 'var(--accent-ai)', violet: 'var(--violet)', muted: 'var(--text-3)',
  }
  const color = toneMap[tone] || 'var(--accent)'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      textAlign: 'left', padding: 18,
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 12, opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'border-color .14s',
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 128,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: `color-mix(in oklch, ${color} 16%, transparent)`,
          color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em', flex: 1 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            color: 'var(--text-3)', background: 'var(--surface-2)', fontWeight: 500,
          }}>{badge}</span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.45, flex: 1 }}>{desc}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color }}>{cta} →</div>
    </button>
  )
}
