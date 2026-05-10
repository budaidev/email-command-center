import { useState } from 'react'
import { Sparkles, Check, Copy } from 'lucide-react'
import { api } from '../../api/client'
import type { GtdHealth } from '../../api/client'
import { FlowModal } from './FlowModal'
import { Avatar } from '../shared/Avatar'

interface Props {
  pulse: GtdHealth
  onClose: () => void
}

export function NudgeWaitingFor({ pulse, onClose }: Props) {
  const [draft, setDraft] = useState<{ item: GtdHealth['waitingFor'][0]; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<Record<number, boolean>>({})

  const openDraft = async (item: GtdHealth['waitingFor'][0]) => {
    setDraft({ item, text: 'Drafting...' })
    setLoading(true)
    try {
      const result = await api.draftNudge({
        title: item.title,
        who: item.who || 'them',
        sinceDays: item.sinceDays,
      })
      setDraft({ item, text: result.text || `Just following up on ${item.title}. It's been about ${item.sinceDays} days. Any update?` })
    } catch {
      setDraft({ item, text: `Just following up on ${item.title}. It's been about ${item.sinceDays} days. Any update?` })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft.text)
      setCopied(c => ({ ...c, [draft.item.id]: true }))
      setDraft(null)
    } catch {}
  }

  return (
    <FlowModal
      kicker="Nudge Waiting-For"
      tone="var(--violet)"
      title={draft ? `Nudge ${draft.item.who || 'contact'}` : "People you're blocked on"}
      onClose={onClose}
    >
      {!draft ? (
        <div style={{ padding: '12px 16px 18px' }}>
          {pulse.waitingFor.map(w => {
            const isStale = w.sinceDays > 7
            return (
              <div key={w.id} style={{
                padding: 14, marginBottom: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--line-soft)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: copied[w.id] ? 0.5 : 1,
              }}>
                <Avatar name={w.who || w.title} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{w.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                    {w.who && <><b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{w.who}</b> · </>}
                    {w.sinceDays}d waiting
                    {w.nudged && ` · nudged ${w.nudged}`}
                    {isStale && <span style={{ color: 'var(--warn)', marginLeft: 6 }}>· stale</span>}
                  </div>
                </div>
                {copied[w.id] ? (
                  <span style={{ fontSize: 11, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} /> Copied
                  </span>
                ) : (
                  <button onClick={() => openDraft(w)} style={{
                    padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
                    background: 'var(--accent-ai-soft)', color: 'var(--accent-ai)',
                    border: '1px solid color-mix(in oklch, var(--accent-ai) 28%, transparent)',
                    borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Sparkles size={11} /> Draft nudge
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
            To: <b style={{ color: 'var(--text-2)' }}>{draft.item.who || 'contact'}</b>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Subject: Re: {draft.item.title}
          </div>
          <textarea
            value={draft.text}
            onChange={(e) => setDraft(d => d ? { ...d, text: e.target.value } : null)}
            style={{
              width: '100%', minHeight: 140, padding: 12,
              fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)',
              background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8,
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setDraft(null)} style={{
              padding: '6px 12px', fontSize: 12, color: 'var(--text-2)',
              border: '1px solid var(--line)', borderRadius: 6,
            }}>Back</button>
            <button onClick={copyToClipboard} disabled={loading} style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--violet)', color: 'var(--bg)', borderRadius: 6,
              opacity: loading ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Copy size={12} /> Copy to clipboard
            </button>
          </div>
        </div>
      )}
    </FlowModal>
  )
}
