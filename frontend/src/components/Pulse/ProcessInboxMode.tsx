import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../../api/client'
import type { GtdHealth } from '../../api/client'
import { FlowModal } from './FlowModal'
import { Kbd } from '../shared/Kbd'

interface Props {
  pulse: GtdHealth
  onClose: () => void
}

const VERBS = [
  { key: 'Y', label: 'Next', col: 'next', color: 'var(--accent)' },
  { key: 'W', label: 'Waiting', col: 'wait', color: 'var(--warn)' },
  { key: 'S', label: 'Someday', col: 'some', color: 'var(--violet)' },
  { key: 'D', label: 'Done', col: 'done', color: 'var(--ok)' },
  { key: 'X', label: 'Trash', col: '_trash', color: 'var(--text-3)' },
  { key: 'K', label: 'Skip', col: '_skip', color: 'var(--text-4)' },
] as const

const verbLabel = (v: string) =>
  ({ next: 'Next Action', wait: 'Waiting For', some: 'Someday', done: 'Done', _trash: 'Trash', _skip: 'Skipped' }[v] || v)

const GTD_TIPS = [
  'Is this actionable? If not, trash it or move to Someday.',
  'Can you do it in 2 minutes? Just do it now and mark Done.',
  'Is it a multi-step outcome? That\'s a project — break it down.',
  'Who is the next action for? If someone else, it\'s Waiting For.',
  'If it might be useful someday but not now, park it in Someday.',
]

export function ProcessInboxMode({ pulse, onClose }: Props) {
  const queryClient = useQueryClient()
  const [items] = useState(pulse.inboxToProcess)
  const [idx, setIdx] = useState(0)
  const [decisions, setDecisions] = useState<{ id: number; title: string; verb: string }[]>([])
  const [tipsOpen, setTipsOpen] = useState(false)

  const current = items[idx]
  const done = idx >= items.length

  const moveMutation = useMutation({
    mutationFn: ({ taskId, col }: { taskId: number; col: string }) =>
      api.updateTask(taskId, { col: col as any }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const decide = (verb: string) => {
    if (!current) return
    setDecisions(d => [...d, { id: current.id, title: current.title, verb }])
    if (verb === '_trash') {
      deleteMutation.mutate(current.id)
    } else if (verb !== '_skip') {
      moveMutation.mutate({ taskId: current.id, col: verb })
    }
    setIdx(i => i + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) { if (e.key === 'Escape') onClose(); return }
      const k = e.key.toLowerCase()
      if (k === 'y') decide('next')
      else if (k === 'w') decide('wait')
      else if (k === 's') decide('some')
      else if (k === 'd') decide('done')
      else if (k === 'x') decide('_trash')
      else if (k === 'k') decide('_skip')
      else if (k === 'escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, done])

  return (
    <FlowModal
      kicker="Process Inbox · zero mode"
      tone="var(--accent)"
      title={done ? 'Inbox zero' : `Item ${idx + 1} of ${items.length}`}
      onClose={onClose}
    >
      {done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'color-mix(in oklch, var(--accent) 18%, transparent)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Inbox size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Inbox zero
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            {decisions.length} {decisions.length === 1 ? 'item' : 'items'} processed.
          </p>
          <div style={{
            marginTop: 20, padding: 12, background: 'var(--surface-2)',
            borderRadius: 10, textAlign: 'left', maxWidth: 360, margin: '20px auto 0',
          }}>
            {['next', 'wait', 'some', 'done', '_trash', '_skip'].map(v => {
              const count = decisions.filter(d => d.verb === v).length
              if (!count) return null
              return (
                <div key={v} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', padding: '3px 0' }}>
                  <span>→ {verbLabel(v)}</span>
                  <span className="mono" style={{ color: 'var(--text-3)' }}>{count}</span>
                </div>
              )
            })}
          </div>
          <button onClick={onClose} style={{
            marginTop: 18, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
            background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
          }}>Done</button>
        </div>
      ) : (
        <div style={{ padding: '28px 24px 22px' }}>
          {/* Current item */}
          <div style={{
            padding: '18px 20px', background: 'var(--surface-2)',
            border: '1px solid var(--line-soft)', borderRadius: 12,
            marginBottom: 20,
          }}>
            <div className="mono" style={{
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-3)', marginBottom: 8,
            }}>
              {current.src === 'email' ? 'Captured from email' : 'Manual entry'}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--text)' }}>
              {current.title}
            </div>
            {current.notes && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--line-soft)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: 'var(--text-3)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 180,
                  overflowY: 'auto',
                }}
              >
                {current.notes}
              </div>
            )}
          </div>

          {/* Decision buttons */}
          <div style={{
            fontSize: 11, color: 'var(--text-3)', marginBottom: 10,
            letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            What is it?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {VERBS.map(v => (
              <button
                key={v.key}
                onClick={() => decide(v.col)}
                style={{
                  padding: '10px 6px', borderRadius: 8,
                  background: `color-mix(in oklch, ${v.color} 10%, var(--surface-2))`,
                  border: `1px solid color-mix(in oklch, ${v.color} 24%, var(--line))`,
                  color: 'var(--text)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: v.color, color: 'var(--bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>{v.key}</span>
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>{v.label}</span>
              </button>
            ))}
          </div>

          {/* Progress */}
          <div style={{ marginTop: 16, height: 3, background: 'var(--surface-3)', borderRadius: 2 }}>
            <div style={{
              width: `${(idx / items.length) * 100}%`, height: '100%',
              background: 'var(--accent)', borderRadius: 2, transition: 'width .25s',
            }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-4)' }}>
            Keyboard: <Kbd>Y</Kbd> <Kbd>W</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> <Kbd>X</Kbd> <Kbd>K</Kbd> · <Kbd>Esc</Kbd> to exit
          </div>

          {/* GTD Tips (collapsible) */}
          <button
            onClick={() => setTipsOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 16, fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500,
            }}
          >
            {tipsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            GTD tips
          </button>
          {tipsOpen && (
            <div style={{
              marginTop: 8, padding: '10px 12px',
              background: 'var(--surface-2)', borderRadius: 8,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {GTD_TIPS.map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                  • {tip}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FlowModal>
  )
}
