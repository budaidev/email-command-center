import { Check, Plus, Sparkles } from 'lucide-react'
import type { VikunjaStatus } from '../../api/client'

interface TasksHeaderProps {
  total: number
  completedThisWeek: number
  showCompleted: boolean
  setShowCompleted: (v: boolean) => void
  onNewTask: () => void
  onFixVague?: () => void
  vagueCount?: number
  status: VikunjaStatus | undefined
}

export function TasksHeader({
  total,
  completedThisWeek,
  showCompleted,
  setShowCompleted,
  onNewTask,
  onFixVague,
  vagueCount = 0,
  status,
}: TasksHeaderProps) {
  return (
    <header
      style={{
        padding: '22px 32px 18px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        flexShrink: 0,
      }}
    >
      <div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: 8,
          }}
        >
          Tasks &middot; Vikunja &middot;{' '}
          <span style={{ color: status?.connected ? 'var(--ok)' : 'var(--danger)' }}>
            &bull; {status?.connected ? 'connected' : 'disconnected'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: '-0.025em',
            }}
          >
            Getting Things Done
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {total} open &middot; {completedThisWeek} completed this week
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {vagueCount > 0 && onFixVague && (
          <button
            onClick={onFixVague}
            title="Improve vague task titles"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              fontSize: 11.5,
              fontWeight: 500,
              background: 'var(--accent-ai-soft)',
              color: 'var(--accent-ai)',
              border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
              borderRadius: 999,
            }}
          >
            <Sparkles size={11} />
            Fix {vagueCount} vague
          </button>
        )}
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          title="Toggle completed column"
          style={{
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 500,
            border: '1px solid var(--line)',
            borderRadius: 7,
            color: 'var(--text-2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Check size={12} />
          {showCompleted ? 'Hide done' : 'Show done'}
        </button>

        <button
          onClick={onNewTask}
          style={{
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderRadius: 7,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={13} />
          New task
          <span className="kbd">N</span>
        </button>
      </div>
    </header>
  )
}
