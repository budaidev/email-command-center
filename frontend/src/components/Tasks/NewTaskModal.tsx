import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '../../api/client'
import { SparkleButton } from '../shared/SparkleButton'
import { SuggestionChips } from '../shared/SuggestionChips'
import { Kbd } from '../shared/Kbd'

interface NewTaskModalProps {
  onClose: () => void
  onSubmit: (data: { title: string; col: 'inbox' }) => void
}

export function NewTaskModal({ onClose, onSubmit }: NewTaskModalProps) {
  const [title, setTitle] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [pickedIdx, setPickedIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const fetchSuggestions = async () => {
    const t = title.trim()
    if (!t) return
    setLoading(true)
    try {
      const result = await api.suggestTaskTitle(t)
      setSuggestions(result.rewrites || [])
      setPickedIdx(null)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  const pick = (s: string) => {
    const i = suggestions.indexOf(s)
    setTitle(s)
    setPickedIdx(i >= 0 ? i : null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit({ title: title.trim(), col: 'inbox' })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      fetchSuggestions()
    } else if (e.key === 'Enter' && title.trim() && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.38)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '14vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        style={{
          width: 520,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <Plus size={13} style={{ color: 'var(--text-3)' }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            New task · Inbox
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 18px 14px' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setPickedIdx(null)
              }}
              placeholder="What needs to happen?"
              style={{
                width: '100%',
                padding: '12px 42px 12px 14px',
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                outline: 'none',
                boxShadow: pickedIdx != null ? '0 0 0 3px var(--accent-ai-soft)' : 'none',
                transition: 'box-shadow .2s',
              }}
            />
            <div style={{ position: 'absolute', right: 8, top: 7 }}>
              <SparkleButton loading={loading} onClick={fetchSuggestions} />
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-4)',
              display: 'flex',
              gap: 10,
            }}
          >
            <span><Kbd>↵</Kbd> create</span>
            <span><Kbd>⌘</Kbd><Kbd>↵</Kbd> rewrite with AI</span>
            <span><Kbd>Esc</Kbd> cancel</span>
          </div>

          {suggestions.length > 0 && (
            <SuggestionChips
              options={suggestions}
              value={pickedIdx != null ? suggestions[pickedIdx] : null}
              onPick={pick}
              onDismiss={() => setSuggestions([])}
              label="Rewrites"
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--surface)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              color: 'var(--text-2)',
              border: '1px solid var(--line)',
              borderRadius: 7,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 500,
              background: title.trim() ? 'var(--accent)' : 'var(--surface-2)',
              color: title.trim() ? 'var(--accent-ink)' : 'var(--text-4)',
              borderRadius: 7,
              opacity: title.trim() ? 1 : 0.5,
            }}
          >
            Add to Inbox
          </button>
        </div>
      </div>
    </div>
  )
}
