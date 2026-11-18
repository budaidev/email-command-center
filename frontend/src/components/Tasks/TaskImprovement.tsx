import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Edit, Check, X } from 'lucide-react'
import { api } from '../../api/client'
import { SuggestionChips } from '../shared/SuggestionChips'

interface Props {
  onClose: () => void
}

export function TaskImprovement({ onClose }: Props) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['tasks', 'vague'],
    queryFn: () => api.getVagueTasks(true),
  })

  const items = data?.suggestions || []
  const [idx, setIdx] = useState(0)
  const [mode, setMode] = useState<'choose' | 'ai' | 'manual' | 'done'>('choose')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [manual, setManual] = useState('')

  const total = items.length
  const current = items[idx]
  const effectiveMode = (!current && mode !== 'done') ? 'done' : mode
  const progress = effectiveMode === 'done' ? 100 : total > 0 ? Math.round((idx / total) * 100) : 0

  const updateMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      api.updateTask(taskId, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const reset = () => { setMode('choose'); setSuggestions([]); setManual('') }

  const skip = () => {
    if (idx + 1 >= total) { setMode('done'); return }
    setIdx(i => i + 1); reset()
  }

  const apply = (newTitle: string) => {
    if (!current) return
    updateMutation.mutate({ taskId: current.taskId, title: newTitle })
    if (idx + 1 >= total) { setMode('done'); return }
    setIdx(i => i + 1); reset()
  }

  const fetchAI = async () => {
    if (!current) return
    setLoading(true)
    try {
      const result = await api.improveTaskTitle(current.currentTitle)
      setSuggestions(result.rewrites || [])
      setMode('ai')
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,.42)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 540, background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 14,
          boxShadow: 'var(--shadow)', overflow: 'hidden',
        }}
      >
        {/* Header with progress */}
        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={13} style={{ color: 'var(--accent-ai)' }} />
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent-ai)',
            }}>
              Sharpen vague tasks
            </span>
            <div style={{ flex: 1 }} />
            {effectiveMode !== 'done' && current && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{idx + 1} of {total}</span>
            )}
            <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1, marginLeft: 8 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'var(--accent-ai)', transition: 'width .3s ease',
            }} />
          </div>
        </div>

        {effectiveMode === 'done' ? (
          <div style={{ padding: '36px 28px 32px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 24, margin: '0 auto 14px',
              background: 'color-mix(in oklch, var(--ok) 18%, transparent)',
              color: 'var(--ok)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={22} strokeWidth={2.25} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
              All clear
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              {total === 0
                ? 'No vague tasks found. Your list is already well-written!'
                : `${total} ${total === 1 ? 'task' : 'tasks'} sharpened. Your list is ready to execute.`}
            </p>
            <button onClick={onClose} style={{
              marginTop: 20, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
              background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 7,
            }}>Done</button>
          </div>
        ) : current ? (
          <div style={{ padding: '20px 22px 18px' }}>
            {/* Current task */}
            <div style={{
              padding: 14, background: 'var(--surface-2)',
              border: '1px solid var(--line-soft)', borderRadius: 10,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                "{current.currentTitle}"
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--warn)' }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--warn)' }} />
                {current.issue}
              </div>
            </div>

            {effectiveMode === 'choose' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={fetchAI} disabled={loading} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
                  border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Sparkles size={13} style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {loading ? 'Thinking...' : 'Get AI suggestions'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>3 action-oriented rewrites</div>
                </button>
                <button onClick={() => setMode('manual')} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: 'var(--surface-2)', color: 'var(--text)',
                  border: '1px solid var(--line)', borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Edit size={13} style={{ color: 'var(--text-2)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Write my own</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Rephrase it yourself</div>
                </button>
              </div>
            )}

            {effectiveMode === 'ai' && (
              <SuggestionChips options={suggestions} onPick={apply} label="Pick a rewrite" />
            )}

            {effectiveMode === 'manual' && (
              <div>
                <input
                  autoFocus
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && manual.trim() && apply(manual.trim())}
                  placeholder="Rewrite with a strong verb + clear outcome"
                  style={{
                    width: '100%', padding: '10px 12px',
                    fontSize: 14, background: 'var(--surface-2)', color: 'var(--text)',
                    border: '1px solid var(--line)', borderRadius: 8, outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button onClick={() => setMode('choose')} style={{
                    padding: '6px 10px', fontSize: 12, color: 'var(--text-2)',
                    border: '1px solid var(--line)', borderRadius: 6,
                  }}>Back</button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => manual.trim() && apply(manual.trim())}
                    disabled={!manual.trim()}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 500,
                      background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
                      opacity: manual.trim() ? 1 : 0.5,
                    }}
                  >Apply</button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {effectiveMode !== 'done' && current && (
          <div style={{
            padding: '10px 18px', display: 'flex', alignItems: 'center',
            borderTop: '1px solid var(--line-soft)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
              Keep your list sharp — specific tasks get done.
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={skip} style={{ fontSize: 11.5, color: 'var(--text-3)', padding: '5px 10px' }}>
              Skip →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
