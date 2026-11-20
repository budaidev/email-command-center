import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, Save, Power, RefreshCw, ExternalLink } from 'lucide-react'
import { api } from '../../api/client'
import type { ScoreBacktest, ScoreEmailRef } from '../../api/client'

// Card #246: points per signal. Learned from an LLM's labels on unlabelled mail,
// overridable here, measured on the owner's own labels.

const input: CSSProperties = {
  padding: '4px 6px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--text)', outline: 'none',
}
const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
  color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6,
}
const primary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }
const caption: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }
const pts = (n: number) => `${n > 0 ? '+' : ''}${n}`
const STATUS_LABEL: Record<string, string> = { draft: 'piszkozat', active: 'aktív', off: 'kikapcsolva' }

export function TriageSignalScore() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['scoring'], queryFn: api.getScoring })
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [thr, setThr] = useState<{ high?: string; low?: string }>({})
  const [result, setResult] = useState<ScoreBacktest | null>(null)
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['scoring'] })
  const fail = (e: Error) => setMsg({ text: e.message, error: true })

  const model = data?.model ?? null
  const features = data?.features ?? []
  const dirty = Object.keys(edits).length > 0 || thr.high !== undefined || thr.low !== undefined
  const overrides = () => Object.fromEntries(Object.entries(edits).map(([k, v]) => [k, v.trim() === '' ? null : Number(v)]))
  const draftBody = () => ({
    ...(Object.keys(edits).length ? { overrides: overrides() } : {}),
    ...(thr.high !== undefined ? { high: Number(thr.high) } : {}),
    ...(thr.low !== undefined ? { low: Number(thr.low) } : {}),
  })

  const trainM = useMutation({ mutationFn: api.trainScoring, onSuccess: () => { setMsg({ text: 'Újratanítva. A felülírásaid megmaradtak; backteszteld.', error: false }); setResult(null); refresh() }, onError: fail })
  const backtestM = useMutation({ mutationFn: () => api.backtestScoring(draftBody()), onSuccess: r => { setResult(r); setMsg(null); refresh() }, onError: fail })
  const saveM = useMutation({
    mutationFn: () => api.updateScoring(draftBody()),
    onSuccess: () => { setEdits({}); setThr({}); setMsg({ text: 'Mentve. Backteszteld, mielőtt élesíted.', error: false }); refresh() },
    onError: fail,
  })
  const statusM = useMutation({ mutationFn: (status: string) => api.updateScoring({ status }), onSuccess: () => { setMsg(null); refresh() }, onError: fail })

  const rows = features.map(f => ({ ...f, ...(model?.features[f.key] ?? { learned: 0, override: null, share: 0 }) }))
    .sort((a, b) => Math.abs(b.override ?? b.learned) - Math.abs(a.override ?? a.learned))

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Pontozás
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
            — jelenként tanult pontok; 10 pont = 1 log-odds, +30 ≈ 95% eséllyel fontos
          </span>
        </h3>
        <div style={{ flex: 1 }} />
        {model && <span className="mono" style={{ fontSize: 11, color: model.status === 'active' ? 'var(--ok)' : 'var(--text-3)' }}>{STATUS_LABEL[model.status]}</span>}
        <button style={btn} onClick={() => trainM.mutate()} disabled={trainM.isPending} title="A pontok újratanulása az LLM tanító címkéiből">
          {trainM.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />} Tanítás
        </button>
      </div>

      {msg && <div style={{ marginBottom: 10, padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--line)', color: msg.error ? 'var(--danger)' : 'var(--text-2)' }}>{msg.text}</div>}

      {!model && <div style={{ ...card, padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Még nincs tanított modell. Nyomd meg a Tanítás gombot.</div>}

      {model && (
        <div style={card}>
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--text-3)', borderBottom: '1px solid var(--line-soft)' }}>
            Tanítva: {model.training?.at.slice(0, 16).replace('T', ' ')} · {model.training?.rows} levél ({model.training?.positives} fontos) · kiinduló pont {pts(model.intercept)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px', gap: 8, padding: '6px 14px', ...caption }}>
            <span>Jel</span><span style={{ textAlign: 'right' }}>Tanult</span><span style={{ textAlign: 'right' }}>Saját</span><span style={{ textAlign: 'right' }}>Gyakoriság</span>
          </div>
          {rows.map(r => {
            const eff = edits[r.key] !== undefined ? (edits[r.key].trim() === '' ? r.learned : Number(edits[r.key])) : (r.override ?? r.learned)
            return (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px', gap: 8, alignItems: 'center', padding: '3px 14px', borderTop: '1px solid var(--line-soft)', fontSize: 12 }}>
                <span>
                  <span className="mono" style={{ display: 'inline-block', width: 42, fontWeight: 600, color: eff > 0 ? 'var(--ok)' : eff < 0 ? 'var(--danger)' : 'var(--text-4)' }}>{pts(eff)}</span>
                  {r.label}
                </span>
                <span className="mono" style={{ textAlign: 'right', color: 'var(--text-3)' }}>{pts(r.learned)}</span>
                <input style={{ ...input, textAlign: 'right' }} placeholder="—"
                  value={edits[r.key] ?? (r.override === null ? '' : String(r.override))}
                  onChange={e => setEdits({ ...edits, [r.key]: e.target.value })} title="Üresen hagyva a tanult pont érvényes" />
                <span style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-4)' }}>{r.share}%</span>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 12 }}>Fontos, ha ≥</span>
            <input style={{ ...input, width: 55, textAlign: 'right' }} value={thr.high ?? String(model.high)} onChange={e => setThr({ ...thr, high: e.target.value })} />
            <span style={{ fontSize: 12 }}>· nem fontos (LLM nélkül), ha ≤</span>
            <input style={{ ...input, width: 55, textAlign: 'right' }} value={thr.low ?? String(model.low)} onChange={e => setThr({ ...thr, low: e.target.value })} />
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>közte: LLM</span>
            <div style={{ flex: 1 }} />
            <button style={btn} onClick={() => backtestM.mutate()} disabled={backtestM.isPending}>
              {backtestM.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={11} />} Backteszt
            </button>
            <button style={primary} onClick={() => saveM.mutate()} disabled={!dirty || saveM.isPending}><Save size={11} /> Mentés</button>
            {model.status !== 'active'
              ? <button style={btn} disabled={dirty} title={dirty ? 'Előbb mentsd' : 'Csak backtesztelt változat élesíthető'} onClick={() => statusM.mutate('active')}><Power size={11} /> Élesítés</button>
              : <button style={btn} onClick={() => statusM.mutate('off')}><Power size={11} /> Kikapcsolás</button>}
          </div>
          {dirty && <div style={{ padding: '0 14px 8px', fontSize: 11, color: 'var(--text-3)' }}>Nem mentett változás: a backteszt a szerkesztett változatot méri.</div>}
        </div>
      )}

      {(result || model?.last_backtest) && <ScoreResult r={(result || model!.last_backtest)!} />}
    </div>
  )
}

function Row({ e }: { e: ScoreEmailRef }) {
  return (
    <a href={`/email/${e.id}`} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '5px 14px', fontSize: 11.5, borderTop: '1px solid var(--line-soft)', color: 'var(--text)', textDecoration: 'none' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <span className="mono" style={{ width: 40, fontWeight: 600 }}>{pts(e.points)}</span>
        <span style={{ color: e.labelled_important ? 'var(--ok)' : 'var(--text-3)', width: 70 }}>{e.labelled_important ? 'te: fontos' : 'te: nem'}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.sender} · {e.subject}</span>
        <ExternalLink size={11} color="var(--text-4)" />
      </div>
      <div style={{ paddingLeft: 118, fontSize: 10.5, color: 'var(--text-4)' }}>{e.breakdown.map(b => `${pts(b.points)} ${b.label}`).join(' · ')}</div>
    </a>
  )
}

function ScoreResult({ r }: { r: ScoreBacktest }) {
  const band = (b: ScoreBacktest['bands'][number]) => `${b.from === null ? '' : `${b.from} <`} pont ${b.to === null ? '' : `≤ ${b.to}`}`
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={caption}>Backteszt · küszöb {r.low} / {r.high}</span>
        <span style={{ fontSize: 12 }}>
          Összes levél: <b>{Math.round((100 * (r.all.important + r.all.not_important)) / r.all.total)}%</b> dől el LLM nélkül
          ({r.all.not_important} nem fontos, {r.all.important} fontos)
        </span>
        <span style={{ fontSize: 12, color: r.labelled.wrong ? 'var(--danger)' : 'var(--ok)' }}>
          Címkéiden: {r.labelled.decided}/{r.labelled.total} eldöntve, <b>{r.labelled.wrong} hiba</b>
        </span>
      </div>
      <div style={{ ...caption, padding: '4px 14px' }}>Pontsávok — a címkéid közül mennyi fontos</div>
      {r.bands.map((b, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 120px 1fr', gap: 8, padding: '3px 14px', fontSize: 12, borderTop: '1px solid var(--line-soft)' }}>
          <span className="mono">{band(b)}</span>
          <span style={{ color: 'var(--text-3)' }}>{b.emails} levél</span>
          <span>{b.labelled ? <>{b.important}/{b.labelled} fontos ({Math.round((100 * b.important) / b.labelled)}%)</> : <span style={{ color: 'var(--text-4)' }}>nincs címke</span>}</span>
        </div>
      ))}
      {r.wrong && r.wrong.length > 0 && <>
        <div style={{ ...caption, padding: '10px 14px 4px', color: 'var(--danger)' }}>Rosszul döntene a címkéid szerint</div>
        {r.wrong.map(e => <Row key={e.id} e={e} />)}
      </>}
      {r.near && r.near.length > 0 && <>
        <div style={{ ...caption, padding: '10px 14px 4px' }}>Az LLM-zónában, a küszöbhöz legközelebb — itt segít a hangolás</div>
        {r.near.map(e => <Row key={e.id} e={e} />)}
      </>}
    </div>
  )
}
