import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  X,
  ListTodo,
  Reply,
  FileText,
  HelpCircle,
  Calendar,
  Package,
  Send,
  Users,
  ChevronRight,
} from 'lucide-react'
import type { TriageResult } from '../../api/client'
import { TriageCriteria } from '../Triage/TriageCriteria'

const ACTION_ICONS: Record<string, React.ReactNode> = {
  reply: <Reply size={11} />,
  review: <FileText size={11} />,
  decide: <HelpCircle size={11} />,
  schedule: <Calendar size={11} />,
  pickup: <Package size={11} />,
  send: <Send size={11} />,
  delegate: <Users size={11} />,
  task: <ListTodo size={11} />,
}

const ACTION_LABELS: Record<string, string> = {
  reply: 'Reply',
  review: 'Review',
  decide: 'Decide',
  schedule: 'Schedule',
  pickup: 'Pickup',
  send: 'Send',
  delegate: 'Delegate',
  task: 'Task',
}

function scoreColor(score: number) {
  if (score >= 76) return 'var(--danger)'
  if (score >= 51) return 'var(--warn)'
  return 'var(--text-3)'
}

interface Props {
  item: TriageResult
  onApprove: () => void
  onDismiss: () => void
  onCreateTask: () => void
}

export function TriageEmailCard({ item, onApprove, onDismiss, onCreateTask }: Props) {
  const navigate = useNavigate()
  const [acting, setActing] = useState(false)
  const color = scoreColor(item.score)
  const actionIcon = ACTION_ICONS[item.action_type]
  const actionLabel = ACTION_LABELS[item.action_type]

  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'start',
        opacity: acting ? 0.5 : 1,
        transition: 'opacity .2s',
      }}
    >
      <div>
        {/* Top row: score badge + action type + sender */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span
            className="mono"
            title={`Rules: ${item.rule_score ?? 0} + AI: ${item.ai_score ?? 0}`}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 4,
              background: `color-mix(in oklch, ${color} 16%, transparent)`,
              color,
            }}
          >
            {item.score}
            {(item.rule_score > 0 || item.ai_score > 0) && (
              <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 3, fontSize: 9 }}>
                {item.rule_score ?? 0}+{item.ai_score ?? 0}
              </span>
            )}
          </span>
          {actionLabel && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10.5,
                fontWeight: 500,
                color: 'var(--accent)',
                letterSpacing: '0.03em',
              }}
            >
              {actionIcon}
              {actionLabel.toUpperCase()}
            </span>
          )}
          <span style={{ color: 'var(--text-4)', fontSize: 11 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            from {item.sender_name || item.sender_email}
          </span>
          {item.category_name && (
            <>
              <span style={{ color: 'var(--text-4)', fontSize: 11 }}>·</span>
              <span style={{
                fontSize: 10.5, color: item.category_color || 'var(--text-3)', fontWeight: 500,
              }}>
                {item.category_name}
              </span>
            </>
          )}
        </div>

        {/* Subject */}
        <h3
          style={{
            margin: '0 0 4px',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
          onClick={() => navigate(`/email/${item.email_id}`)}
        >
          {item.subject}
        </h3>

        {/* Reason */}
        {item.reason && (
          <p style={{ margin: '0 0 6px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)', maxWidth: 620 }}>
            {item.reason}
          </p>
        )}

        {/* Which rubric criteria were met, with the quotes (card #239) */}
        <TriageCriteria item={item} />

        {/* Suggested task preview */}
        {item.suggested_task && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
            Task: <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{item.suggested_task}</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setActing(true); onApprove() }}
            disabled={acting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
              background: 'color-mix(in oklch, var(--ok) 12%, transparent)',
              color: 'var(--ok)',
              border: '1px solid color-mix(in oklch, var(--ok) 28%, transparent)',
              borderRadius: 6,
            }}
          >
            <Check size={12} /> Approve
          </button>
          <button
            onClick={() => { setActing(true); onDismiss() }}
            disabled={acting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
              color: 'var(--text-3)',
              border: '1px solid var(--line)',
              borderRadius: 6,
            }}
          >
            <X size={12} /> Dismiss
          </button>
          <button
            onClick={() => { setActing(true); onCreateTask() }}
            disabled={acting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
              background: 'var(--accent-ai-soft)',
              color: 'var(--accent-ai)',
              border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
              borderRadius: 6,
            }}
          >
            <ListTodo size={12} /> Create task
          </button>
        </div>
      </div>

      {/* Right: open email */}
      <button
        onClick={() => navigate(`/email/${item.email_id}`)}
        style={{
          padding: 8, borderRadius: 8, color: 'var(--text-3)',
          border: '1px solid var(--line)',
        }}
        title="Open email"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
