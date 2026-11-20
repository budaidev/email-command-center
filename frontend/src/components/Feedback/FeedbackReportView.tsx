import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loader2, Sparkles, ExternalLink } from 'lucide-react'
import { api } from '../../api/client'
import type { Verdict } from '../../api/client'
import { VERDICT_LABEL } from './VerdictFeedback'

// Where the classifier and the owner disagree: corrections ("Rossz besorolás") and
// the implicit labels (TODO = important, "Láttam" on Tudni akarom = want to know).

const V: Verdict[] = ['important', 'want_to_know', 'not_important']
const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', cursor: 'pointer',
}
const cell: CSSProperties = { padding: '5px 10px', fontSize: 12, borderBottom: '1px solid var(--line)', textAlign: 'right' }

export function FeedbackReportView({ onOpen }: { onOpen: (id: string) => void }) {
  const [days, setDays] = useState(30)
  const rep = useQuery({ queryKey: ['feedback-report', days], queryFn: () => api.getFeedbackReport(days) })
  const sug = useMutation({ mutationFn: () => api.suggestFromFeedback(days) })
  const r = rep.data

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        <span style={{ flex: 1 }}>
          A „Rossz besorolás” jelzéseid, és amit a döntéseidből tudni lehet (TODO = fontos, „Láttam” a Tudni akarom fülön = tudni akarom).
          A „Nem kell” nem számít bele: az nem mondja meg, fontos volt-e.
        </span>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          style={{ fontSize: 12, padding: '4px 6px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 6 }}>
          {[7, 30, 90].map(d => <option key={d} value={d}>{d} nap</option>)}
        </select>
      </div>

      {rep.isLoading && <div style={{ color: 'var(--text-3)', fontSize: 13 }}><Loader2 size={14} className="spin" /> Betöltés…</div>}
      {rep.error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Nem sikerült betölteni: {(rep.error as Error).message}</div>}
      {r && (
        <>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            <b>{r.judged}</b> címkézett levél ({r.explicit} jelzés), ebből a gép <b>{r.agree}</b>-nél ({r.judged ? Math.round(100 * r.agree / r.judged) : 0}%) találta el.
            {Object.entries(r.by_version).length > 1 && (
              <span style={{ color: 'var(--text-3)' }}> Verziónként: {Object.entries(r.by_version).map(([v, x]) => `${v} ${x.agree}/${x.n}`).join(', ')}</span>
            )}
          </div>

          <table style={{ borderCollapse: 'collapse', marginBottom: 18 }}>
            <thead><tr>
              <th style={{ ...cell, textAlign: 'left', color: 'var(--text-3)', fontWeight: 500 }}>gép ↓ / te →</th>
              {V.map(v => <th key={v} style={{ ...cell, color: 'var(--text-3)', fontWeight: 500 }}>{VERDICT_LABEL[v]}</th>)}
            </tr></thead>
            <tbody>{V.map(p => (
              <tr key={p}>
                <td style={{ ...cell, textAlign: 'left', color: 'var(--text-3)' }}>{VERDICT_LABEL[p]}</td>
                {V.map(v => (
                  <td key={v} className="mono" style={{ ...cell, fontWeight: p === v ? 400 : 600,
                    color: p === v ? 'var(--text-3)' : r.matrix[p][v] ? 'var(--danger)' : 'var(--text-4)' }}>{r.matrix[p][v]}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, flex: 1 }}>Eltérések és megjegyzések</h3>
            <button style={btn} disabled={sug.isPending || (!r.mismatches.length && !r.notes.length)} onClick={() => sug.mutate()}
              title="Az eltéréseket és a megjegyzéseidet elküldi az LLM-nek (email-llm-strong), ami szabályt vagy promptjavítást javasol">
              {sug.isPending ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Javaslat kérése
            </button>
          </div>
          {sug.error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{(sug.error as Error).message}</div>}
          {sug.data && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.5, padding: '12px 14px', marginBottom: 14,
              background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>{sug.data.cases} eset alapján · {sug.data.model}</div>
              {sug.data.text}
            </div>
          )}
          {!r.mismatches.length && !r.notes.length && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13, border: '1px dashed var(--line)', borderRadius: 10 }}>
              Még nincs eltérés. A kártyákon és a levél nézetben a „Rossz besorolás” gombbal jelezhetsz.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...r.mismatches, ...r.notes.filter(n => n.predicted === n.verdict)].map(l => (
              <div key={l.email_id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.subject || '(nincs tárgy)'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{l.sender_email} · {l.at.slice(0, 10)} · {l.kind === 'explicit' ? 'jelzés' : 'döntésből'}</div>
                  </div>
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    gép: <b>{l.predicted ? VERDICT_LABEL[l.predicted] : '–'}</b> → te: <b>{VERDICT_LABEL[l.verdict]}</b>
                  </span>
                  <button style={{ ...btn, padding: '3px 6px' }} title="Levél megnyitása" onClick={() => onOpen(l.email_id)}><ExternalLink size={13} /></button>
                </div>
                {l.note && <div style={{ fontSize: 12.5, marginTop: 6 }}>„{l.note}”</div>}
                {l.why && <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-3)' }}>A gép indoka: {l.why}</div>}
                <div className="mono" style={{ fontSize: 10.5, marginTop: 4, color: 'var(--text-4)' }}>{l.prompt_version} · {l.model}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
