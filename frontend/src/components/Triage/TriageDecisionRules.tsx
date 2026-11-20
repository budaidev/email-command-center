import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Play, Loader2, X, RefreshCw, Save, Power, ExternalLink } from 'lucide-react'
import { api } from '../../api/client'
import type { DecisionRule, RuleBacktest, RuleCondition, RuleField, RuleEmailRef } from '../../api/client'

// Card #247: decision rules over the deterministic signals, with a backtest
// against the owner's labels and the LLM runs. The LLM part lives in Langfuse.

const OP_LABEL: Record<string, string> = {
  is_true: 'igaz', is_false: 'nem igaz', equals: '=', not_equals: '≠', in: 'egyike', not_in: 'egyik sem',
  contains: 'tartalmazza', not_contains: 'nem tartalmazza', matches: 'regex', is_empty: 'üres', not_empty: 'nem üres',
  gt: '>', lt: '<', any_true: 'bármelyik igaz', none_true: 'egyik sem igaz',
}
const VERDICT_LABEL: Record<string, string> = {
  not_important: 'Nem fontos — LLM nélkül',
  important: 'Fontos — az LLM is fut, a döntést felülírja',
}
const STATUS_LABEL: Record<string, string> = { draft: 'piszkozat', active: 'aktív', off: 'kikapcsolva' }
const NEEDS_VALUE = new Set(['equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'matches', 'gt', 'lt', 'any_true', 'none_true'])

const input: CSSProperties = {
  padding: '5px 8px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--text)', outline: 'none',
}
const btn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
  color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6,
}
const primary: CSSProperties = { ...btn, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }
const caption: CSSProperties = { fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }

type Draft = { id?: string; name: string; verdict: string; note: string; conditions: RuleCondition[]; status?: string }
const emptyDraft = (): Draft => ({ name: '', verdict: 'not_important', note: '', conditions: [{ field: 'list_unsubscribe', op: 'is_true' }] })
const toDraft = (r: DecisionRule): Draft => ({ id: r.id, name: r.name, verdict: r.verdict, note: r.note || '', conditions: r.conditions, status: r.status })

function describe(c: RuleCondition, fields: RuleField[]) {
  const f = fields.find(x => x.key === c.field)
  if (f?.type === 'boolset') {
    const names = (c.value || '').split(',').map(k => fields.find(x => x.key === k.trim())?.label || k).join(' / ')
    return `${OP_LABEL[c.op]}: ${names}`
  }
  return `${f?.label || c.field} ${OP_LABEL[c.op] || c.op}${NEEDS_VALUE.has(c.op) ? ` „${c.value ?? ''}”` : ''}`
}

export function TriageDecisionRules() {
  const qc = useQueryClient()
  const { data, error } = useQuery({ queryKey: ['rules'], queryFn: api.getRules })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [result, setResult] = useState<RuleBacktest | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['rules'] })
  const fail = (e: Error) => setMessage({ text: e.message, error: true })

  const fields = data?.fields ?? []
  const ops = data?.ops ?? {}
  const rules = data?.rules ?? []

  const sync = useMutation({ mutationFn: api.syncLabels, onSuccess: () => { setMessage(null); refresh() }, onError: fail })
  const backtest = useMutation({
    mutationFn: (d: Draft) => (d.id && !dirty(d) ? api.backtestRule(d.id) : api.backtestDraft(d)),
    onSuccess: r => { setResult(r); setMessage(null); refresh() },
    onError: fail,
  })
  const save = useMutation({
    mutationFn: (d: Draft) => (d.id
      ? api.updateRule(d.id, { name: d.name, verdict: d.verdict as DecisionRule['verdict'], note: d.note, conditions: d.conditions })
      : api.createRule({ name: d.name, verdict: d.verdict as DecisionRule['verdict'], note: d.note, conditions: d.conditions, status: 'draft' })),
    onSuccess: r => { setDraft(toDraft(r)); setMessage({ text: 'Mentve. Backteszteld, mielőtt élesíted.', error: false }); refresh() },
    onError: fail,
  })
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DecisionRule['status'] }) => api.updateRule(id, { status }),
    onSuccess: r => { if (draft?.id === r.id) setDraft(toDraft(r)); setMessage(null); refresh() },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRule(id),
    onSuccess: () => { setDraft(null); setResult(null); refresh() },
    onError: fail,
  })

  function dirty(d: Draft) {
    const saved = rules.find(r => r.id === d.id)
    return !saved || JSON.stringify(saved.conditions) !== JSON.stringify(d.conditions) || saved.verdict !== d.verdict
  }
  const setCond = (i: number, c: Partial<RuleCondition>) =>
    setDraft(d => d && { ...d, conditions: d.conditions.map((x, j) => (j === i ? { ...x, ...c } : x)) })

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Döntési szabályok
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
            — LLM nélküli jelek alapján; az aktív „nem fontos” szabály a levelet nem küldi LLM-nek
          </span>
        </h3>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Címkéid: {data?.labels.n ?? 0} levél ({data?.labels.important ?? 0} fontos)
          {data?.labels.synced_at && <> · {data.labels.synced_at.slice(0, 16)}</>}
        </span>
        <button style={btn} onClick={() => sync.mutate()} disabled={sync.isPending} title="Címkék frissítése a Langfuse adathalmazból">
          {sync.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />} Címkék
        </button>
        <button style={primary} onClick={() => { setDraft(emptyDraft()); setResult(null) }}>
          <Plus size={11} /> Új szabály
        </button>
      </div>

      {(message || error) && (
        <div style={{ marginBottom: 10, padding: '8px 12px', fontSize: 12, borderRadius: 8, border: '1px solid var(--line)',
          color: error || message?.error ? 'var(--danger)' : 'var(--text-2)' }}>
          {message?.text || (error as Error).message}
        </div>
      )}

      {/* Rule list */}
      <div style={card}>
        {rules.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Még nincs szabály.</div>
        )}
        {rules.map((r, i) => (
          <div key={r.id} onClick={() => { setDraft(toDraft(r)); setResult(null) }} style={{
            display: 'grid', gridTemplateColumns: '1fr 150px 90px', gap: 10, alignItems: 'center', padding: '9px 14px', cursor: 'pointer',
            borderBottom: i < rules.length - 1 ? '1px solid var(--line-soft)' : 'none',
            background: draft?.id === r.id ? 'var(--surface-2)' : undefined,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {VERDICT_LABEL[r.verdict]} · {r.conditions.length} feltétel
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {r.last_backtest
                ? <>lefedettség {r.last_backtest.coverage_pct}% · címkén {r.last_backtest.labelled.fires}/{r.last_backtest.labelled.wrong} hiba</>
                : <span style={{ color: 'var(--text-4)' }}>nincs backteszt</span>}
            </div>
            <span className="mono" style={{ fontSize: 11, textAlign: 'right',
              color: r.status === 'active' ? 'var(--ok)' : r.status === 'off' ? 'var(--text-4)' : 'var(--text-3)' }}>
              {STATUS_LABEL[r.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Editor */}
      {draft && (
        <div style={{ ...card, marginTop: 12, padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input style={{ ...input, flex: 1 }} placeholder="Szabály neve" value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })} />
            <select style={input} value={draft.verdict} onChange={e => setDraft({ ...draft, verdict: e.target.value })}>
              {Object.entries(VERDICT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button style={{ ...btn, border: 'none' }} onClick={() => { setDraft(null); setResult(null) }}><X size={12} /></button>
          </div>

          <div style={{ ...caption, marginBottom: 6 }}>Feltételek — mind teljesüljön</div>
          {draft.conditions.map((c, i) => {
            const f = fields.find(x => x.key === c.field)
            const opList = ops[f?.type || 'bool'] || []
            return (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                <select style={{ ...input, width: 260 }} value={c.field} onChange={e => {
                  const nf = fields.find(x => x.key === e.target.value)
                  setCond(i, { field: e.target.value, op: (ops[nf?.type || 'bool'] || [])[0], value: '' })
                }}>
                  {fields.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
                <select style={input} value={c.op} onChange={e => setCond(i, { op: e.target.value })}>
                  {opList.map(o => <option key={o} value={o}>{OP_LABEL[o] || o}</option>)}
                </select>
                {f?.type === 'boolset' ? (
                  <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {fields.filter(x => x.type === 'bool').map(x => {
                      const keys = (c.value || '').split(',').filter(Boolean)
                      const on = keys.includes(x.key)
                      return (
                        <button key={x.key} onClick={() => setCond(i, { value: (on ? keys.filter(k => k !== x.key) : [...keys, x.key]).join(',') })}
                          style={{ ...btn, padding: '2px 7px', fontSize: 10.5,
                            background: on ? 'var(--accent)' : undefined, color: on ? 'var(--accent-ink)' : 'var(--text-3)' }}>
                          {x.label}
                        </button>
                      )
                    })}
                  </div>
                ) : NEEDS_VALUE.has(c.op) ? (
                  <input style={{ ...input, flex: 1 }} value={c.value ?? ''} onChange={e => setCond(i, { value: e.target.value })}
                    placeholder={c.op === 'in' || c.op === 'not_in' ? 'vesszővel elválasztva, pl. insurer,bank' : 'érték'} />
                ) : <div style={{ flex: 1 }} />}
                <button style={{ ...btn, border: 'none', padding: 5 }} onClick={() =>
                  setDraft({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })}><Trash2 size={12} /></button>
              </div>
            )
          })}
          <button style={{ ...btn, marginBottom: 10 }} onClick={() =>
            setDraft({ ...draft, conditions: [...draft.conditions, { field: 'kw_payment', op: 'is_false' }] })}>
            <Plus size={11} /> Feltétel
          </button>

          <textarea style={{ ...input, width: '100%', minHeight: 40, boxSizing: 'border-box', marginBottom: 10 }}
            placeholder="Megjegyzés: miért van ez a szabály" value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={btn} onClick={() => backtest.mutate(draft)} disabled={backtest.isPending}>
              {backtest.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={11} />} Backteszt
            </button>
            <button style={primary} onClick={() => save.mutate(draft)} disabled={save.isPending || !draft.name.trim()}>
              <Save size={11} /> Mentés
            </button>
            {draft.id && draft.status !== 'active' && (
              <button style={btn} disabled={dirty(draft)} title={dirty(draft) ? 'Előbb mentsd' : 'Csak backtesztelt szabály élesíthető'}
                onClick={() => setStatus.mutate({ id: draft.id!, status: 'active' })}>
                <Power size={11} /> Élesítés
              </button>
            )}
            {draft.id && draft.status === 'active' && (
              <button style={btn} onClick={() => setStatus.mutate({ id: draft.id!, status: 'off' })}><Power size={11} /> Kikapcsolás</button>
            )}
            <div style={{ flex: 1 }} />
            {draft.id && (
              <button style={{ ...btn, color: 'var(--danger)' }} onClick={() => confirm('Törlöd a szabályt?') && remove.mutate(draft.id!)}>
                <Trash2 size={11} /> Törlés
              </button>
            )}
          </div>
          {draft.id && dirty(draft) && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Nem mentett változás: a backteszt a szerkesztett változatot méri.</div>
          )}
        </div>
      )}

      {result && <BacktestResult r={result} conditions={draft?.conditions ?? []} fields={fields} />}

      <DomainCategories />
    </div>
  )
}

function EmailRow({ e, extra }: { e: RuleEmailRef; extra?: string }) {
  return (
    <a href={`/email/${e.id}`} target="_blank" rel="noreferrer" style={{
      display: 'grid', gridTemplateColumns: '170px 1fr 14px', gap: 8, padding: '5px 14px', fontSize: 11.5,
      borderTop: '1px solid var(--line-soft)', color: 'var(--text)', textDecoration: 'none',
    }}>
      <span style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.sender}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {e.subject}{extra && <span style={{ color: 'var(--text-4)' }}> — {extra}</span>}
      </span>
      <ExternalLink size={11} color="var(--text-4)" />
    </a>
  )
}

function BacktestResult({ r, conditions, fields }: { r: RuleBacktest; conditions: RuleCondition[]; fields: RuleField[] }) {
  const ok = r.labelled.wrong === 0
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={caption}>Backteszt</span>
        <span style={{ fontSize: 12 }}><b>{r.coverage_pct}%</b> az összes levélből ({r.fires} / {r.total_emails})</span>
        <span style={{ fontSize: 12, color: ok ? 'var(--ok)' : 'var(--danger)' }}>
          Címkéiden: {r.labelled.fires} találat, <b>{r.labelled.wrong} hiba</b>
        </span>
        {r.labelled.caught_pct !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            a(z) {r.labelled.of_class} „{r.verdict === 'important' ? 'fontos' : 'nem fontos'}” címkéből {r.labelled.caught_pct}%-ot elkap
          </span>
        )}
      </div>
      <div style={{ padding: '0 14px 8px', fontSize: 11, color: 'var(--text-4)' }}>
        {conditions.map(c => describe(c, fields)).join(' · ')}
      </div>

      {r.wrong && r.wrong.length > 0 && <>
        <div style={{ ...caption, padding: '8px 14px', color: 'var(--danger)' }}>Hibás a címkéid szerint</div>
        {r.wrong.map(e => <EmailRow key={e.id} e={e} extra={e.labelled_important ? 'te: fontos' : e.want_to_know ? 'te: csak tudnod kell' : 'te: nem fontos'} />)}
      </>}

      <div style={{ ...caption, padding: '10px 14px 6px' }}>Összevetés az LLM-futásokkal (a találatokon)</div>
      {r.llm.length === 0 && <div style={{ padding: '0 14px 8px', fontSize: 11.5, color: 'var(--text-4)' }}>Nincs LLM-ítélet ezekre a levelekre.</div>}
      {r.llm.map(s => (
        <div key={s.source}>
          <div style={{ padding: '4px 14px', fontSize: 12 }}>
            {s.source}: {s.evaluated} levélből <b style={{ color: s.disagree ? 'var(--danger)' : 'var(--ok)' }}>{s.disagree} eltérés</b>
          </div>
          {(s.examples || []).map(e => <EmailRow key={s.source + e.id} e={e} extra={e.why || undefined} />)}
        </div>
      ))}

      {r.sample && r.sample.length > 0 && <>
        <div style={{ ...caption, padding: '10px 14px 6px' }}>Minta a találatokból (nem címkézett) — fusd át</div>
        {r.sample.map(e => <EmailRow key={e.id} e={e} />)}
      </>}
    </div>
  )
}

const CATEGORIES = ['government', 'insurer', 'bank', 'utility', 'school', 'work', 'invoicing']

function DomainCategories() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [nd, setNd] = useState({ domain: '', category: 'insurer' })
  const [err, setErr] = useState<string | null>(null)
  const { data } = useQuery({ queryKey: ['rules', 'domains'], queryFn: api.getDomainCategories, enabled: open })
  const done = () => { setErr(null); qc.invalidateQueries({ queryKey: ['rules', 'domains'] }) }
  const put = useMutation({ mutationFn: (x: { domain: string; category: string }) => api.setDomainCategory(x.domain, x.category),
    onSuccess: () => { setNd({ domain: '', category: nd.category }); done() }, onError: (e: Error) => setErr(e.message) })
  const del = useMutation({ mutationFn: (d: string) => api.deleteDomainCategory(d), onSuccess: done, onError: (e: Error) => setErr(e.message) })

  return (
    <div style={{ marginTop: 14 }}>
      <button style={{ ...btn, border: 'none', padding: 0 }} onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Domain-kategóriák (a „Feladó domain-kategóriája” mezőhöz)
      </button>
      {open && (
        <div style={{ ...card, marginTop: 8 }}>
          {err && <div style={{ padding: '6px 14px', fontSize: 11.5, color: 'var(--danger)' }}>{err}</div>}
          {(data?.domains ?? []).map(d => (
            <div key={d.domain} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 24px', gap: 8, alignItems: 'center',
              padding: '4px 14px', borderBottom: '1px solid var(--line-soft)', fontSize: 12 }}>
              <span className="mono">{d.domain}</span>
              <select style={input} value={d.category} onChange={e => put.mutate({ domain: d.domain, category: e.target.value })}>
                {[...new Set([...CATEGORIES, d.category])].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'right' }}>{d.emails} levél</span>
              <button style={{ padding: 3, color: 'var(--text-4)' }} onClick={() => del.mutate(d.domain)}><Trash2 size={11} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px' }}>
            <input style={{ ...input, flex: 1 }} placeholder="domain, pl. bank.hu" value={nd.domain}
              onChange={e => setNd({ ...nd, domain: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && nd.domain && put.mutate(nd)} />
            <select style={input} value={nd.category} onChange={e => setNd({ ...nd, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={primary} disabled={!nd.domain} onClick={() => put.mutate(nd)}><Plus size={11} /> Hozzáad</button>
          </div>
        </div>
      )}
    </div>
  )
}
