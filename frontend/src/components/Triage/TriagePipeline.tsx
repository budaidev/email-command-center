import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../api/client'

const STEP_ICONS: Record<string, string> = {
  categorize: 'Rules',
  summary: 'AI',
  references: 'Extract',
  auto_tag: 'Tags',
  score: 'Score',
  actions: 'Actions',
}

const SCOPE_OPTIONS = [
  { value: 'days-1', label: 'Last 1 day', body: { days: 1 } },
  { value: 'days-7', label: 'Last 7 days', body: { days: 7 } },
  { value: 'days-30', label: 'Last 30 days', body: { days: 30 } },
  { value: 'unenriched', label: 'All unenriched', body: { scope: 'unenriched' } },
  { value: 'all', label: 'All emails', body: { scope: 'all' } },
]

export function TriagePipeline() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [scope, setScope] = useState('days-1')
  const [selectedSteps, setSelectedSteps] = useState<string[]>([])

  const { data: status } = useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: api.getPipelineStatus,
    refetchInterval: 10_000,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updatePipelineStep(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
  })

  const runMutation = useMutation({
    mutationFn: () => {
      const scopeBody = SCOPE_OPTIONS.find(s => s.value === scope)?.body || { days: 1 }
      const steps = selectedSteps.length > 0 ? selectedSteps : undefined
      return api.runPipeline({ ...scopeBody, steps } as any)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline'] }),
  })

  const steps = status?.steps || []

  return (
    <div style={{ marginBottom: 32 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)',
          marginBottom: expanded ? 14 : 0,
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Pipeline
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>
          — {status?.completed ?? 0} / {status?.totalEmails ?? 0} processed
          {(status?.inProgress ?? 0) > 0 && ` · ${status?.inProgress} running`}
        </span>
      </button>

      {expanded && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Stats bar */}
          <div style={{
            padding: '10px 16px', display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-3)',
            borderBottom: '1px solid var(--line-soft)',
          }}>
            <span><b style={{ color: 'var(--text)' }}>{status?.totalEmails ?? 0}</b> total</span>
            <span><b style={{ color: 'var(--ok)' }}>{status?.completed ?? 0}</b> processed</span>
            <span><b style={{ color: 'var(--warn)' }}>{status?.unenriched ?? 0}</b> unenriched</span>
            {(status?.errors ?? 0) > 0 && <span><b style={{ color: 'var(--danger)' }}>{status?.errors}</b> errors</span>}
            {status?.lastRun && <span>Last run: {new Date(status.lastRun).toLocaleString()}</span>}
          </div>

          {/* Steps */}
          <div style={{ padding: '10px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
              Pipeline steps (in order)
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {steps.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleMutation.mutate({ id: s.id, active: !s.is_active })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
                    borderRadius: 6,
                    background: s.is_active ? 'var(--surface-2)' : 'transparent',
                    color: s.is_active ? 'var(--text)' : 'var(--text-4)',
                    border: `1px solid ${s.is_active ? 'var(--line)' : 'var(--line-soft)'}`,
                    opacity: s.is_active ? 1 : 0.6,
                    textDecoration: s.is_active ? 'none' : 'line-through',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
                    background: s.type === 'scorer' ? 'var(--accent-ai-soft)' : s.type === 'action' ? 'var(--warn)' : 'var(--surface-3)',
                    color: s.type === 'scorer' ? 'var(--accent-ai)' : s.type === 'action' ? 'var(--warn)' : 'var(--text-3)',
                  }}>
                    {STEP_ICONS[s.name] || s.type}
                  </span>
                  {s.name}
                </button>
              ))}
            </div>

            {/* Run controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--line-soft)' }}>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                style={{
                  padding: '5px 8px', fontSize: 11.5, color: 'var(--text)',
                  background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
                }}
              >
                {SCOPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Optional: only run specific steps */}
              <select
                value={selectedSteps.length === 0 ? 'all' : selectedSteps.join(',')}
                onChange={(e) => {
                  if (e.target.value === 'all') setSelectedSteps([])
                  else setSelectedSteps(e.target.value.split(','))
                }}
                style={{
                  padding: '5px 8px', fontSize: 11.5, color: 'var(--text)',
                  background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
                }}
              >
                <option value="all">All steps</option>
                <option value="categorize,score">Categorize + Score only (fast)</option>
                <option value="score">Score only (fastest)</option>
                <option value="summary,references,score">Enrich + Score (with AI summaries)</option>
              </select>

              <button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', fontSize: 12, fontWeight: 500,
                  background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
                }}
              >
                {runMutation.isPending
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Queued...</>
                  : <><Play size={12} /> Run pipeline</>
                }
              </button>

              {runMutation.isSuccess && (
                <span style={{ fontSize: 11, color: 'var(--ok)' }}>
                  Queued {(runMutation.data as any)?.queued ?? 0} emails
                </span>
              )}
            </div>
          </div>

          {/* Recent errors */}
          {status?.recentErrors && status.recentErrors.length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: 6 }}>
                Recent errors
              </div>
              {status.recentErrors.map((e: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{e.sender_email}</span> · {e.subject?.slice(0, 40)}
                  <br />
                  <span style={{ color: 'var(--danger)' }}>{e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
