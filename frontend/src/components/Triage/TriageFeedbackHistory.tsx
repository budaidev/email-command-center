import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, RotateCcw } from 'lucide-react'
import { api } from '../../api/client'

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'approve', label: 'Approved' },
  { id: 'dismiss', label: 'Dismissed' },
  { id: 'create_task', label: 'Tasks' },
]

const DECISION_STYLES: Record<string, { color: string; label: string }> = {
  approve: { color: 'var(--ok)', label: 'Approved' },
  dismiss: { color: 'var(--text-3)', label: 'Dismissed' },
  create_task: { color: 'var(--accent-ai)', label: 'Task created' },
}

export function TriageFeedbackHistory() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const limit = 30

  const { data, isLoading } = useQuery({
    queryKey: ['triage', 'feedback-history', filter, search, page],
    queryFn: () => api.getTriageFeedbackHistory({
      limit,
      offset: page * limit,
      decision: filter || undefined,
      search: search || undefined,
    }),
  })

  const flipMutation = useMutation({
    mutationFn: ({ feedbackId, decision }: { feedbackId: string; decision: string }) =>
      api.flipTriageFeedback(feedbackId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage'] }),
  })

  const decisions = data?.decisions ?? []
  const total = data?.total ?? 0

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Decision History
        </h3>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{total} total</span>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
          background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--line-soft)',
        }}>
          <Search size={12} style={{ color: 'var(--text-4)' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search..."
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', width: 120 }}
          />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setPage(0) }}
            style={{
              padding: '4px 10px', fontSize: 11.5, fontWeight: 500, borderRadius: 999,
              background: filter === f.id ? 'var(--text)' : 'var(--surface)',
              color: filter === f.id ? 'var(--bg)' : 'var(--text-2)',
              border: filter === f.id ? 'none' : '1px solid var(--line)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Loading...</div>
        ) : decisions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>No feedback yet</div>
        ) : (
          decisions.map((d, i) => {
            const style = DECISION_STYLES[d.decision] || { color: 'var(--text-3)', label: d.decision }
            const flipTo = d.decision === 'approve' ? 'dismiss' : 'approve'
            return (
              <div
                key={d.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 70px 80px 28px',
                  gap: 10, alignItems: 'center',
                  padding: '10px 14px',
                  borderBottom: i < decisions.length - 1 ? '1px solid var(--line-soft)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.sender_name || d.sender_email} · <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{d.subject}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                    {d.triage_score != null && <span className="mono">score {d.triage_score}</span>}
                    {d.triage_action && d.triage_action !== 'none' && <span>{d.triage_action}</span>}
                    {d.category_name && <span>{d.category_name}</span>}
                    {d.reason && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>"{d.reason}"</span>}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'right' }}>
                  {new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: style.color, textAlign: 'right' }}>
                  {style.label}
                </span>
                <button
                  onClick={() => flipMutation.mutate({ feedbackId: d.id, decision: flipTo })}
                  title={`Flip to ${flipTo}`}
                  style={{ color: 'var(--text-4)', padding: 2, borderRadius: 4 }}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, opacity: page === 0 ? 0.5 : 1 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>
            {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, opacity: (page + 1) * limit >= total ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
