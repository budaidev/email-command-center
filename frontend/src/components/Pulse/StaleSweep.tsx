import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { GtdHealth } from '../../api/client'
import { FlowModal } from './FlowModal'

interface Props {
  pulse: GtdHealth
  onClose: () => void
}

type Action = 'keep' | 'some' | 'sharpen' | 'trash'

const actionColor = (a: Action) =>
  ({ keep: 'var(--text-3)', some: 'var(--violet)', sharpen: 'var(--accent-ai)', trash: 'var(--danger)' }[a])

const listLabelShort = (l: string) =>
  ({ next: 'Next', wait: 'Wait', some: 'Some', inbox: 'Inbox' }[l] || l)

export function StaleSweep({ pulse, onClose }: Props) {
  const queryClient = useQueryClient()
  const [actions, setActions] = useState<Record<number, Action>>({})
  const items = pulse.stale
  const handled = Object.keys(actions).length

  const moveMutation = useMutation({
    mutationFn: ({ taskId, col }: { taskId: number; col: string }) =>
      api.updateTask(taskId, { col: col as any }),
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
  })

  const applyAll = async () => {
    for (const item of items) {
      const action = actions[item.id]
      if (!action || action === 'keep' || action === 'sharpen') continue
      if (action === 'trash') await deleteMutation.mutateAsync(item.id)
      else if (action === 'some') await moveMutation.mutateAsync({ taskId: item.id, col: 'some' })
    }
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    onClose()
  }

  return (
    <FlowModal
      kicker="Stale sweep"
      tone="var(--warn)"
      title={`${items.length} tasks untouched > 14 days`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{handled} of {items.length} handled</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
            border: '1px solid var(--line)', borderRadius: 6,
          }}>Close</button>
          <button
            disabled={handled < items.length}
            onClick={applyAll}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--warn)', color: 'var(--bg)', borderRadius: 6,
              opacity: handled < items.length ? 0.5 : 1,
            }}
          >Apply all</button>
        </div>
      }
    >
      <div style={{ padding: '12px 16px 18px' }}>
        {items.map(it => {
          const action = actions[it.id]
          const color = action ? actionColor(action) : 'var(--line)'
          return (
            <div key={it.id} style={{
              padding: '12px 14px', marginBottom: 8,
              background: 'var(--surface-2)', borderRadius: 10,
              border: action ? `1px solid color-mix(in oklch, ${color} 32%, transparent)` : '1px solid var(--line-soft)',
              opacity: action === 'trash' ? 0.5 : 1,
              transition: 'opacity .2s, border-color .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 4,
                  background: 'var(--surface-3)', color: 'var(--text-3)', fontWeight: 500,
                }}>{listLabelShort(it.list)}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, flex: 1 }}>{it.title}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>{it.ageDays}d</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['keep', 'some', 'sharpen', 'trash'] as const).map(a => (
                  <SweepBtn
                    key={a}
                    label={a === 'some' ? '→ Someday' : a.charAt(0).toUpperCase() + a.slice(1)}
                    tone={actionColor(a)}
                    active={action === a}
                    onClick={() => setActions(prev => ({ ...prev, [it.id]: a }))}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </FlowModal>
  )
}

function SweepBtn({ label, tone, active, onClick }: { label: string; tone: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 11.5, fontWeight: 500, borderRadius: 6,
      background: active ? `color-mix(in oklch, ${tone} 18%, transparent)` : 'var(--surface)',
      color: active ? tone : 'var(--text-2)',
      border: `1px solid ${active ? `color-mix(in oklch, ${tone} 32%, transparent)` : 'var(--line)'}`,
    }}>{label}</button>
  )
}
