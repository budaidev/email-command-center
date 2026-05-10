import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../api/client'

export function TriagePromptPreview() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'system' | 'context' | 'sample'>('context')

  const { data: preview } = useQuery({
    queryKey: ['triage', 'prompt-preview'],
    queryFn: () => api.getTriagePromptPreview(5),
    enabled: open,
  })

  return (
    <div style={{ marginBottom: 32 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)',
          marginBottom: open ? 12 : 0,
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        The Prompt
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>
          — what the AI sees
        </span>
      </button>

      {open && preview && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line-soft)' }}>
            {(['system', 'context', 'sample'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 11.5, fontWeight: 500,
                  color: tab === t ? 'var(--accent)' : 'var(--text-3)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          <pre
            className="scroll"
            style={{
              margin: 0, padding: 16, fontSize: 11.5, lineHeight: 1.6,
              color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 400, overflowY: 'auto',
              background: 'var(--surface-2)',
            }}
          >
            {tab === 'system' && preview.system}
            {tab === 'context' && preview.context}
            {tab === 'sample' && preview.sample}
          </pre>

          {/* Stats footer */}
          <div style={{
            padding: '8px 16px', fontSize: 11, color: 'var(--text-4)',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex', gap: 16,
          }}>
            <span>{preview.stats.totalTriaged} emails triaged</span>
            <span>{preview.stats.totalFeedback} feedback decisions</span>
            <span>{preview.feedbackExamples.length} examples in prompt</span>
          </div>
        </div>
      )}
    </div>
  )
}
