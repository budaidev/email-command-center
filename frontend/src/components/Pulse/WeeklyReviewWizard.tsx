import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../../api/client'
import type { GtdHealth } from '../../api/client'
import { FlowModal } from './FlowModal'

interface Props {
  pulse: GtdHealth
  onClose: () => void
}

const REVIEW_STEPS = [
  { id: 'inbox', title: 'Clear your inbox', hint: 'Every item should be trashed, done, delegated, or moved to a list.', list: 'inbox' as const },
  { id: 'next', title: 'Review Next Actions', hint: "Are these still the right next steps? Delete stale ones.", list: 'next' as const },
  { id: 'wait', title: 'Review Waiting-For', hint: 'Nudge anything older than 7 days. Remove if no longer relevant.', list: 'wait' as const },
  { id: 'some', title: 'Review Someday', hint: "Promote things you're ready to act on. Delete dead weight.", list: 'some' as const },
  { id: 'done', title: 'Reflect on Completed', hint: 'Acknowledge what you shipped. Celebrate briefly.', list: 'done' as const },
]

export function WeeklyReviewWizard({ pulse, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const step = REVIEW_STEPS[stepIdx]
  const done = stepIdx >= REVIEW_STEPS.length

  const finish = async () => {
    try {
      await api.completeReview()
    } catch (err) {
      console.warn('Review snapshot failed to save:', err)
    }
    onClose()
  }

  const getItems = (list: string): { id: number; title: string }[] => {
    if (list === 'inbox') return pulse.inboxToProcess
    if (list === 'wait') return pulse.waitingFor.map(w => ({ id: w.id, title: `${w.title} · ${w.who} (${w.sinceDays}d)` }))
    if (list === 'some') return pulse.stale.filter(s => s.list === 'some').map(s => ({ id: s.id, title: `${s.title} · ${s.ageDays}d old` }))
    if (list === 'next') return pulse.stale.filter(s => s.list === 'next').map(s => ({ id: s.id, title: `${s.title} · ${s.ageDays}d old` }))
    return []
  }

  return (
    <FlowModal
      kicker="Weekly Review"
      tone="var(--ok)"
      title={done ? 'Review complete' : step.title}
      onClose={onClose}
      footer={!done ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Step {stepIdx + 1} of {REVIEW_STEPS.length}</span>
          <div style={{ flex: 1, height: 3, background: 'var(--surface-3)', borderRadius: 2, margin: '0 12px' }}>
            <div style={{
              width: `${(stepIdx / REVIEW_STEPS.length) * 100}%`, height: '100%',
              background: 'var(--ok)', borderRadius: 2, transition: 'width .3s',
            }} />
          </div>
          <button
            onClick={() => setStepIdx(i => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            style={{
              padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 6,
              opacity: stepIdx === 0 ? 0.5 : 1,
            }}
          >Back</button>
          <button
            onClick={() => setStepIdx(i => i + 1)}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--ok)', color: 'var(--bg)', borderRadius: 6,
            }}
          >{stepIdx === REVIEW_STEPS.length - 1 ? 'Finish' : 'Next'} →</button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={finish} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            background: 'var(--ok)', color: 'var(--bg)', borderRadius: 6,
          }}>Close</button>
        </div>
      )}
    >
      {done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'color-mix(in oklch, var(--ok) 18%, transparent)',
            color: 'var(--ok)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={28} strokeWidth={2.25} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Weekly review complete
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Your system is clear. See you next week.
          </p>
        </div>
      ) : (
        <div style={{ padding: '20px 22px 18px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            {step.hint}
          </p>

          {step.list === 'done' ? (
            <div style={{
              padding: 18, background: 'var(--surface-2)', borderRadius: 10,
              textAlign: 'center', fontSize: 14,
            }}>
              You completed <b style={{ color: 'var(--ok)' }}>{pulse.processedThisWeek}</b> tasks this week.
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>Nice work.</div>
            </div>
          ) : (
            <ReviewList items={getItems(step.list)} />
          )}

          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 18,
            padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8,
            fontSize: 12.5, color: 'var(--text-2)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={!!checked[step.id]}
              onChange={(e) => setChecked(c => ({ ...c, [step.id]: e.target.checked }))}
            />
            I've reviewed this list
          </label>
        </div>
      )}
    </FlowModal>
  )
}

function ReviewList({ items }: { items: { id: number; title: string }[] }) {
  if (items.length === 0) {
    return (
      <div style={{ padding: 14, fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
        Nothing here.
      </div>
    )
  }
  return (
    <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <div key={it.id} style={{
          padding: '10px 12px', fontSize: 13, color: 'var(--text-2)',
          borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none',
          background: 'var(--surface-2)',
        }}>
          • {it.title}
        </div>
      ))}
    </div>
  )
}
