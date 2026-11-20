import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, X, Eye, Loader2, ExternalLink, Undo2 } from 'lucide-react'
import { api } from '../../api/client'
import type { ReviewItem, ReviewList } from '../../api/client'

// Card #242: what the owner still has to look at. Important emails become GTD
// tasks (Vikunja inbox) or are dismissed; "want to know" ones are marked seen;
// emails where the LLM and the signal score disagree get a decision either way.

const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', cursor: 'pointer',
}
const primary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }
const input: CSSProperties = {
  flex: 1, minWidth: 200, padding: '5px 8px', fontSize: 12.5, background: 'var(--surface-2)', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--text)', outline: 'none',
}

const TABS: { key: ReviewList; label: string; hint: string }[] = [
  { key: 'todo', label: 'Teendő', hint: 'Válasz, döntés, kötelező időpont vagy fizetés. TODO-ba teszed, vagy elveted.' },
  { key: 'know', label: 'Tudni akarom', hint: 'Nincs teendő, csak tudnod kell róla. Átfutod, és „Láttam”.' },
  { key: 'unsure', label: 'Bizonytalan', hint: 'Az LLM és a pontozás nem ért egyet (legfeljebb 15). Te döntesz.' },
]
const CRITERION: Record<string, string> = {
  reply_or_decision: 'válasz / döntés', mandatory_appointment: 'kötelező időpont', payment_due: 'fizetés',
}
const BY: Record<string, string> = { rule: 'szabály', score: 'pontozás', llm: 'LLM' }

export function ReviewView() {
  const [tab, setTab] = useState<ReviewList>('todo')
  const qc = useQueryClient()
  const counts = useQuery({ queryKey: ['review-counts'], queryFn: api.getReviewCounts, refetchInterval: 60_000 })
  const items = useQuery({ queryKey: ['review', tab], queryFn: () => api.getReviewList(tab), refetchInterval: 60_000 })
  const [last, setLast] = useState<{ id: string; subject: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['review'] })
    qc.invalidateQueries({ queryKey: ['review-counts'] })
  }
  const undoM = useMutation({
    mutationFn: (id: string) => api.undoReview(id),
    onSuccess: () => { setLast(null); refresh() },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
      <div style={{ maxWidth: 900 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Átnézés</h2>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>
          Ami a levelekből még rád vár. Amiről döntöttél, lekerül a listáról.
        </div>

        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
          {TABS.map(t => {
            const n = counts.data?.[t.key]
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 12px', fontSize: 13, fontWeight: active ? 600 : 500, background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`, color: active ? 'var(--text)' : 'var(--text-3)',
                cursor: 'pointer', marginBottom: -1,
              }}>
                {t.label}{n !== undefined && <span className="mono" style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-4)' }}>{n}</span>}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>{TABS.find(t => t.key === tab)!.hint}</div>

        {last && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12,
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <span style={{ flex: 1 }}>{last.text}: <b>{last.subject}</b></span>
            <button style={btn} onClick={() => undoM.mutate(last.id)} disabled={undoM.isPending}><Undo2 size={13} /> Visszavon</button>
          </div>
        )}
        {error && (
          <div style={{ padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 8 }}>
            {error} <button style={{ ...btn, marginLeft: 8 }} onClick={() => setError(null)}>OK</button>
          </div>
        )}

        {items.isLoading && <div style={{ color: 'var(--text-3)', fontSize: 13 }}><Loader2 size={14} className="spin" /> Betöltés…</div>}
        {items.error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Nem sikerült betölteni: {(items.error as Error).message}</div>}
        {items.data && items.data.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, border: '1px dashed var(--line)', borderRadius: 10 }}>
            Itt most nincs semmi.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.data?.map(item => (
            <ReviewCard key={item.id} item={item} list={tab}
              onDone={(text) => { setLast({ id: item.id, subject: item.subject, text }); setError(null); refresh() }}
              onError={setError} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ item, list, onDone, onError }: {
  item: ReviewItem; list: ReviewList; onDone: (text: string) => void; onError: (msg: string) => void
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(item.suggested_task || item.subject)
  const [due, setDue] = useState('')
  const [taskOpen, setTaskOpen] = useState(list !== 'know')
  const decideM = useMutation({
    mutationFn: (decision: 'todo' | 'dismissed' | 'seen') =>
      api.decideReview(item.id, { list, decision, ...(decision === 'todo' ? { title, due: due || undefined } : {}) }),
    onSuccess: (_r, decision) => onDone(decision === 'todo' ? 'TODO-ba került (GTD inbox)' : decision === 'seen' ? 'Láttam' : 'Elvetve'),
    onError: (e: Error) => onError(e.message),
  })
  const busy = decideM.isPending
  const date = item.date ? new Date(item.date).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject || '(nincs tárgy)'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{item.sender_name || item.sender_email} · {date}</div>
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
          {BY[item.decided_by]}{item.score ? ` · ${item.score.points > 0 ? '+' : ''}${item.score.points} pont` : ''}
        </span>
        <button style={{ ...btn, padding: '3px 6px' }} title="Levél megnyitása" onClick={() => navigate(`/email/${item.id}`)}><ExternalLink size={13} /></button>
      </div>

      {item.why && <div style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-2)' }}>{item.why}</div>}
      {item.evidence.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {item.evidence.map(ev => (
            <div key={ev.criterion} style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              <b>{CRITERION[ev.criterion] || ev.criterion}</b>: „{ev.quote}”{ev.found === false && <span style={{ color: 'var(--danger)' }}> (nincs a levélben)</span>}
            </div>
          ))}
        </div>
      )}
      {list === 'unsure' && item.score && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
          LLM: <b>{item.important ? 'fontos' : 'nem fontos'}</b>; pontozás: {item.score.breakdown.slice(0, 3).map(b => `${b.points > 0 ? '+' : ''}${b.points} ${b.label}`).join(', ')}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {taskOpen ? (
          <>
            <input style={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Feladat címe"
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) decideM.mutate('todo') }} />
            <input type="date" style={{ ...input, flex: 'none', minWidth: 0 }} value={due} onChange={e => setDue(e.target.value)} title="Határidő (nem kötelező)" />
            <button style={primary} disabled={busy || !title.trim()} onClick={() => decideM.mutate('todo')}>
              {busy ? <Loader2 size={13} className="spin" /> : <CheckSquare size={13} />} TODO-ba
            </button>
          </>
        ) : (
          <button style={btn} disabled={busy} onClick={() => setTaskOpen(true)}><CheckSquare size={13} /> Mégis TODO</button>
        )}
        {list === 'know'
          ? <button style={list === 'know' && !taskOpen ? primary : btn} disabled={busy} onClick={() => decideM.mutate('seen')}><Eye size={13} /> Láttam</button>
          : <button style={btn} disabled={busy} onClick={() => decideM.mutate('dismissed')}><X size={13} /> Nem kell</button>}
      </div>
    </div>
  )
}
