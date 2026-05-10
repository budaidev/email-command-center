import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Play, Loader2, X } from 'lucide-react'
import { api } from '../../api/client'
import type { ScoringRule, ScoringRuleTestResult } from '../../api/client'

const FIELDS = [
  { value: 'sender_domain', label: 'Sender domain' },
  { value: 'sender_email', label: 'Sender email' },
  { value: 'sender_name', label: 'Sender name' },
  { value: 'subject', label: 'Subject' },
  { value: 'category', label: 'Category' },
  { value: 'keyword', label: 'Keyword (subject+body)' },
  { value: 'recipient_email', label: 'Recipient email' },
  { value: 'recipient_domain', label: 'Recipient domain' },
  { value: 'summary', label: 'Summary content (enriched)' },
  { value: 'has_deadline', label: 'Has deadline (true/false)' },
  { value: 'has_amount', label: 'Has amount (true/false)' },
  { value: 'entity', label: 'Entity/contact (enriched)' },
]

const OPERATORS = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: '=' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
]

export function TriageScoringRules() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newRule, setNewRule] = useState({ field: 'sender_domain', operator: 'contains', value: '', score: 10, label: '' })
  const [testResults, setTestResults] = useState<ScoringRuleTestResult[] | null>(null)

  const { data } = useQuery({ queryKey: ['triage', 'scoring-rules'], queryFn: api.getScoringRules })
  const rules = data?.rules ?? []

  const createMutation = useMutation({
    mutationFn: () => api.createScoringRule(newRule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage', 'scoring-rules'] })
      setNewRule({ field: 'sender_domain', operator: 'contains', value: '', score: 10, label: '' })
      setAdding(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteScoringRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage', 'scoring-rules'] }),
  })
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateScoringRule(id, { is_active: active ? 1 : 0 } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage', 'scoring-rules'] }),
  })
  const testMutation = useMutation({
    mutationFn: () => api.testScoringRules(20),
    onSuccess: (data) => setTestResults(data.results),
  })

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Scoring Rules
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
            — static points (0-50) combined with AI score (0-50)
          </span>
        </h3>
        <div style={{ flex: 1 }} />
        <button onClick={() => testMutation.mutate()} disabled={testMutation.isPending} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
          color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6,
        }}>
          {testMutation.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={11} />}
          Test rules
        </button>
        <button onClick={() => setAdding(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
          background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
        }}>
          <Plus size={11} /> Add rule
        </button>
      </div>

      {/* Rules table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
        {rules.length === 0 && !adding && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
            No scoring rules yet. Add rules to boost or suppress specific email patterns.
          </div>
        )}
        {rules.map((r, i) => (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '1fr 60px 28px 28px',
            gap: 8, alignItems: 'center', padding: '8px 14px',
            borderBottom: i < rules.length - 1 || adding ? '1px solid var(--line-soft)' : 'none',
            opacity: r.is_active ? 1 : 0.5,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                {r.label || `${FIELDS.find(f => f.value === r.field)?.label || r.field} ${r.operator} "${r.value}"`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
                {FIELDS.find(f => f.value === r.field)?.label || r.field} {r.operator} "{r.value}"
                {r.action_type && <> · action: {r.action_type}</>}
              </div>
            </div>
            <span className="mono" style={{
              fontSize: 12, fontWeight: 600, textAlign: 'right',
              color: r.score > 0 ? 'var(--ok)' : r.score < 0 ? 'var(--danger)' : 'var(--text-3)',
            }}>
              {r.score > 0 ? '+' : ''}{r.score}
            </span>
            <button onClick={() => toggleMutation.mutate({ id: r.id, active: !r.is_active })}
              title={r.is_active ? 'Disable' : 'Enable'}
              style={{ padding: 4, fontSize: 10, color: 'var(--text-3)', borderRadius: 4 }}>
              {r.is_active ? 'on' : 'off'}
            </button>
            <button onClick={() => deleteMutation.mutate(r.id)}
              style={{ padding: 4, color: 'var(--text-4)', borderRadius: 4 }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {/* Add rule form */}
        {adding && (
          <div style={{ padding: '10px 14px', borderTop: rules.length > 0 ? '1px solid var(--line-soft)' : 'none' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={newRule.field} onChange={e => setNewRule(p => ({ ...p, field: e.target.value }))}
                style={{ flex: 1, padding: '5px 6px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', outline: 'none' }}>
                {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={newRule.operator} onChange={e => setNewRule(p => ({ ...p, operator: e.target.value }))}
                style={{ padding: '5px 6px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', outline: 'none' }}>
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={newRule.value} onChange={e => setNewRule(p => ({ ...p, value: e.target.value }))}
                placeholder="e.g. github.com" autoFocus
                style={{ flex: 2, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', outline: 'none' }} />
              <input type="number" value={newRule.score} onChange={e => setNewRule(p => ({ ...p, score: Number(e.target.value) }))}
                min={-50} max={50} style={{ width: 60, padding: '5px 6px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', outline: 'none', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newRule.label} onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                placeholder="Label (optional, e.g. &quot;GitHub CI → ignore&quot;)"
                onKeyDown={e => e.key === 'Enter' && newRule.value && createMutation.mutate()}
                style={{ flex: 1, padding: '5px 8px', fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--text)', outline: 'none' }} />
              <button onClick={() => createMutation.mutate()} disabled={!newRule.value}
                style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 500, background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6, opacity: newRule.value ? 1 : 0.5 }}>
                Add
              </button>
              <button onClick={() => setAdding(false)} style={{ padding: '5px 6px', color: 'var(--text-3)' }}>
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test results */}
      {testResults && (
        <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', borderBottom: '1px solid var(--line-soft)' }}>
            Rule test · {testResults.length} emails
          </div>
          {testResults.map((r, i) => (
            <div key={r.email_id} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr',
              gap: 8, alignItems: 'center', padding: '6px 14px',
              borderBottom: i < testResults.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 600, textAlign: 'right',
                color: r.rule_score > 0 ? 'var(--ok)' : r.rule_score < 0 ? 'var(--danger)' : 'var(--text-4)',
              }}>
                {r.rule_score > 0 ? '+' : ''}{r.rule_score}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--text-3)' }}>{r.sender_email.split('@')[1] || r.sender_email}</span>
                  {' · '}{r.subject}
                </div>
                {r.matched_rules.length > 0 && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>
                    {r.matched_rules.map(m => `${m.label} (${m.score > 0 ? '+' : ''}${m.score})`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
