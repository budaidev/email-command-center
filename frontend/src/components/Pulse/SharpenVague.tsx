import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { api } from '../../api/client'
import { FlowModal } from './FlowModal'
import { SuggestionChips } from '../shared/SuggestionChips'

interface Props {
  onClose: () => void
}

export function SharpenVague({ onClose }: Props) {
  const queryClient = useQueryClient()
  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['tasks', 'vague'],
    queryFn: () => api.getVagueTasks(true),
  })

  const items = data?.suggestions || []
  const [idx, setIdx] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applied, setApplied] = useState<string[]>([])

  const current = items[idx]
  const done = !queryLoading && !current

  const updateMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      api.updateTask(taskId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const fetchAI = async () => {
    if (!current) return
    setLoading(true)
    try {
      const result = await api.improveTaskTitle(current.currentTitle)
      setSuggestions(result.rewrites || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const apply = (newTitle: string) => {
    if (!current) return
    updateMutation.mutate({ taskId: current.taskId, title: newTitle })
    setApplied(a => [...a, newTitle])
    setIdx(i => i + 1)
    setSuggestions([])
  }

  const skip = () => {
    setIdx(i => i + 1)
    setSuggestions([])
  }

  return (
    <FlowModal
      kicker="Sharpen vague · AI"
      tone="var(--accent-ai)"
      title={done ? 'All sharpened' : current.currentTitle}
      onClose={onClose}
      footer={!done ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {idx + 1} of {items.length} · {applied.length} rewritten
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={skip} style={{
            padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
            border: '1px solid var(--line)', borderRadius: 6,
          }}>Skip →</button>
        </div>
      ) : undefined}
    >
      {queryLoading ? (
        <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)' }}>
          Loading vague tasks...
        </div>
      ) : done ? (
        <div style={{ padding: 36, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28, margin: '0 auto 14px',
            background: 'var(--accent-ai-soft)',
            color: 'var(--accent-ai)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={26} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {applied.length} {applied.length === 1 ? 'task' : 'tasks'} sharpened
          </h3>
          <button onClick={onClose} style={{
            marginTop: 16, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
            background: 'var(--accent-ai)', color: 'var(--accent-ai-ink)', borderRadius: 7,
          }}>Done</button>
        </div>
      ) : (
        <div style={{ padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warn)', marginBottom: 14 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--warn)' }} />
            {current.issue}
          </div>
          {suggestions.length === 0 ? (
            <button onClick={fetchAI} disabled={loading} style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
              border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
              borderRadius: 10, fontSize: 13, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Sparkles size={13} style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} />
              {loading ? 'Thinking...' : 'Get AI rewrites'}
            </button>
          ) : (
            <SuggestionChips options={suggestions} onPick={apply} label="Pick a rewrite" />
          )}
        </div>
      )}
    </FlowModal>
  )
}
