import type { Task } from '../../api/client'
import { TASK_COLUMNS, TASK_CONTEXTS } from '../../api/client'
import { DueChip, parseDue } from './due'

interface TaskDetailSheetProps {
  task: Task
  onClose: () => void
  onMove: (col: string) => void
  onDelete: () => void
}

export function TaskDetailSheet({ task, onClose, onMove, onDelete }: TaskDetailSheetProps) {
  const ctx = TASK_CONTEXTS.find(c => `@${c.id}` === task.ctx || c.label === task.ctx)
  const currentCol = TASK_COLUMNS.find(c => c.id === task.col)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.3)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--line)',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            {currentCol?.label}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              color: 'var(--text-3)',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div
          className="scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 30px' }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
            }}
          >
            {task.title}
          </h2>

          {/* Context + due row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {ctx && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 500,
                  background: `color-mix(in oklch, ${ctx.color} 14%, transparent)`,
                  color: ctx.color,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {ctx.label}
              </span>
            )}
            {task.due && <DueChip info={parseDue(task.due)} />}
          </div>

          {/* Notes */}
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 6,
            }}
          >
            Notes
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: 'var(--text-2)',
              lineHeight: 1.6,
              padding: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)',
              borderRadius: 8,
              minHeight: 72,
              marginBottom: 22,
            }}
          >
            {task.notes ? (
              task.notes.replace(/<[^>]*>/g, '')
            ) : (
              <span style={{ color: 'var(--text-4)' }}>No notes yet.</span>
            )}
          </div>

          {/* Move to */}
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 8,
            }}
          >
            Move to
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
            {TASK_COLUMNS.filter(c => c.id !== task.col).map(c => (
              <button
                key={c.id}
                onClick={() => onMove(c.id)}
                style={{
                  padding: '6px 10px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 7,
                  color: 'var(--text-2)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Delete */}
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button
              onClick={onDelete}
              style={{
                padding: '6px 10px',
                fontSize: 11.5,
                fontWeight: 500,
                background: 'transparent',
                border: '1px solid color-mix(in oklch, var(--danger) 40%, transparent)',
                borderRadius: 7,
                color: 'var(--danger)',
              }}
            >
              Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
