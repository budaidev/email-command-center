import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Flag, Loader2 } from 'lucide-react'
import { api } from '../../api/client'
import type { EmailFeedback, ReviewList, Verdict } from '../../api/client'

// "Rossz besorolás": the owner's verdict for an email, with an optional note.
// From a review list, not important / want to know also takes the email off the list.

export const VERDICT_LABEL: Record<Verdict, string> = { important: 'fontos', want_to_know: 'tudni akarom', not_important: 'nem fontos' }
const ALL: Verdict[] = ['important', 'want_to_know', 'not_important']

const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', cursor: 'pointer',
}

export function FeedbackButton({ onClick, active }: { onClick: () => void; active?: boolean }) {
  return (
    <button style={{ ...btn, ...(active ? { borderColor: 'var(--accent)', color: 'var(--text)' } : {}) }} onClick={onClick}
      title="A gép rosszul sorolta be: add meg a helyeset">
      <Flag size={13} /> Rossz besorolás
    </button>
  )
}

/** The form; `predicted` is left out of the choices. */
export function VerdictFeedbackForm({ emailId, predicted, list, initial, onSaved, onCancel, onError }: {
  emailId: string; predicted: Verdict | null; list?: ReviewList; initial?: { verdict: Verdict; note: string | null } | null
  onSaved: (r: EmailFeedback, verdict: Verdict) => void; onCancel: () => void; onError: (msg: string) => void
}) {
  const choices = ALL.filter(v => v !== predicted)
  const [verdict, setVerdict] = useState<Verdict>(initial?.verdict && initial.verdict !== predicted ? initial.verdict : choices[0])
  const [note, setNote] = useState(initial?.note || '')
  const m = useMutation({
    mutationFn: () => api.giveFeedback(emailId, { verdict, note: note.trim() || undefined, list }),
    onSuccess: r => onSaved(r, verdict),
    onError: (e: Error) => onError(e.message),
  })
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
        A gép szerint: <b>{predicted ? VERDICT_LABEL[predicted] : 'nincs értékelve'}</b>. Szerinted:
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {choices.map(v => (
          <button key={v} onClick={() => setVerdict(v)} style={{ ...btn,
            ...(verdict === v ? { background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid var(--accent)' } : {}) }}>
            {VERDICT_LABEL[v]}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}
        placeholder="Miért? (nem kötelező, de ebből lesz szabály vagy promptjavítás)"
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12.5, background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button style={{ ...btn, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }} disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? <Loader2 size={13} className="spin" /> : <Flag size={13} />} Mentés
        </button>
        <button style={btn} onClick={onCancel}>Mégse</button>
        {list && verdict !== 'important' && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>lekerül a listáról</span>}
        {list && verdict === 'important' && <span style={{ fontSize: 11, color: 'var(--text-4)' }}>utána TODO-ba teheted</span>}
      </div>
    </div>
  )
}
