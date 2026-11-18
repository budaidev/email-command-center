import { Sparkles } from 'lucide-react'
import type { EmailClassification } from '../../api/client'

const LISTS = [
  { id: 'next', label: 'Next' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'someday', label: 'Someday' },
  { id: 'inbox', label: 'Inbox' },
] as const

const listLabel = (l: string) =>
  ({ next: 'Next Action', waiting: 'Waiting For', someday: 'Someday', inbox: 'Inbox' }[l] || 'Inbox')

interface Props {
  proposal: EmailClassification
  onChange: (patch: Partial<EmailClassification>) => void
  onCancel: () => void
  onConfirm: () => void
  confirming?: boolean
}

export function CreateTaskFromEmail({ proposal, onChange, onCancel, onConfirm, confirming }: Props) {
  return (
    <div
      style={{
        marginBottom: 22,
        background: 'var(--accent-ai-soft)',
        border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid color-mix(in oklch, var(--accent-ai) 20%, transparent)',
        }}
      >
        <Sparkles size={12} style={{ color: 'var(--accent-ai)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-ai)',
          }}
        >
          Proposed task
        </span>
        {!proposal.actionable && (
          <span style={{ fontSize: 11, color: 'var(--warn)' }}>
            · low confidence this is actionable
          </span>
        )}
      </div>

      {/* Form */}
      <div style={{ padding: '14px 16px 16px' }}>
        {/* Title */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr',
            gap: 12,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Title</label>
          <input
            value={proposal.title}
            onChange={(e) => onChange({ title: e.target.value })}
            style={{
              padding: '8px 10px',
              fontSize: 13.5,
              fontWeight: 500,
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 7,
              outline: 'none',
            }}
          />
        </div>

        {/* List */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr',
            gap: 12,
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>List</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {LISTS.map((l) => {
              const active = proposal.list === l.id
              return (
                <button
                  key={l.id}
                  onClick={() => onChange({ list: l.id })}
                  style={{
                    padding: '5px 10px',
                    fontSize: 11.5,
                    fontWeight: 500,
                    background: active ? 'var(--accent-ai)' : 'var(--surface)',
                    color: active ? 'var(--accent-ai-ink)' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--accent-ai)' : 'var(--line)'}`,
                    borderRadius: 6,
                  }}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Due hint */}
        {proposal.dueHint && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>Due</label>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>
              {proposal.dueHint}
            </span>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid color-mix(in oklch, var(--accent-ai) 18%, transparent)',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--text-2)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              background: 'var(--surface)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming || !proposal.title.trim()}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--accent-ai)',
              color: 'var(--accent-ai-ink)',
              borderRadius: 6,
              opacity: confirming || !proposal.title.trim() ? 0.6 : 1,
            }}
          >
            {confirming ? 'Creating...' : `Create in ${listLabel(proposal.list)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
