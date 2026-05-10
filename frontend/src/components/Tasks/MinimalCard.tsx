import { Check } from 'lucide-react'
import type { Task } from '../../api/client'
import { TASK_CONTEXTS } from '../../api/client'
import { DueChip, parseDue, relDate } from './due'

interface MinimalCardProps {
  task: Task
  col: string
  dragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onClick: () => void
}

export function MinimalCard({ task, col, dragging, onDragStart, onDragEnd, onClick }: MinimalCardProps) {
  const ctx = TASK_CONTEXTS.find(c => `@${c.id}` === task.ctx || c.label === task.ctx)
  const dueInfo = parseDue(task.due)
  const hasMetaRow = !!(ctx || task.due || task.completedAt)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 10,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transition: 'opacity .14s',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: task.notes || hasMetaRow ? 6 : 0,
          lineHeight: 1.35,
        }}
      >
        {col === 'done' && (
          <Check
            size={11}
            style={{ color: 'var(--ok)', marginRight: 5, verticalAlign: '-1px' }}
          />
        )}
        {task.title}
      </div>

      {task.notes && (
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-3)',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          {task.notes.replace(/<[^>]*>/g, '')}
        </div>
      )}

      {hasMetaRow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {ctx && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: ctx.color,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {ctx.label}
            </span>
          )}
          {task.due && <DueChip info={dueInfo} />}
          {task.completedAt && (
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
              &#10003; {relDate(task.completedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
