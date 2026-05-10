import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Loader2, Save, Check, X } from 'lucide-react'
import { api } from '../../api/client'
import type { TriageBacktestResult } from '../../api/client'

export function TriageBacktest() {
  const queryClient = useQueryClient()
  const { data: prefs } = useQuery({ queryKey: ['triage', 'preferences'], queryFn: api.getTriagePreferences })

  const [draftInstructions, setDraftInstructions] = useState<string | null>(null)
  const [draftProfile, setDraftProfile] = useState<string | null>(null)
  const [testLimit, setTestLimit] = useState(20)
  const [results, setResults] = useState<TriageBacktestResult | null>(null)

  // Initialize drafts from current prefs
  const instructions = draftInstructions ?? prefs?.instructions ?? ''
  const profile = draftProfile ?? prefs?.learnedProfile ?? ''

  const backtestMutation = useMutation({
    mutationFn: () => api.runTriageBacktest({
      instructions,
      learnedProfile: draftProfile !== null ? profile : undefined,
      limit: testLimit,
    }),
    onSuccess: (data) => setResults(data),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.updateTriagePreferences({ instructions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage'] })
      setDraftInstructions(null)
    },
  })

  const hasChanges = draftInstructions !== null || draftProfile !== null

  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Backtest
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 8 }}>
          — test prompt changes before applying
        </span>
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Draft editor */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
            Draft instructions {hasChanges && <span style={{ color: 'var(--warn)' }}>· unsaved</span>}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setDraftInstructions(e.target.value)}
            rows={5}
            style={{
              width: '100%', padding: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--text)',
              background: 'var(--surface-2)', border: `1px solid ${hasChanges ? 'var(--warn)' : 'var(--line)'}`,
              borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }}
          />

          {prefs?.learnedProfile && (
            <>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 12, marginBottom: 6 }}>
                Learned profile (editable for testing)
              </label>
              <textarea
                value={profile}
                onChange={(e) => setDraftProfile(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--text)',
                  background: 'var(--surface-2)', border: '1px solid var(--line)',
                  borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <select
              value={testLimit}
              onChange={(e) => setTestLimit(Number(e.target.value))}
              style={{
                padding: '5px 8px', fontSize: 11, color: 'var(--text-2)',
                background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, outline: 'none',
              }}
            >
              <option value={10}>Last 10 emails</option>
              <option value={20}>Last 20 emails</option>
              <option value={50}>Last 50 emails</option>
            </select>
            <button
              onClick={() => backtestMutation.mutate()}
              disabled={backtestMutation.isPending}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
              }}
            >
              {backtestMutation.isPending
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Testing...</>
                : <><Play size={12} /> Run backtest</>}
            </button>
            {results && hasChanges && (
              <button
                onClick={() => saveMutation.mutate()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500,
                  background: 'var(--ok)', color: 'var(--bg)', borderRadius: 6,
                }}
              >
                <Save size={12} /> Apply changes
              </button>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div>
          {!results && !backtestMutation.isPending && (
            <div style={{
              padding: 32, textAlign: 'center', color: 'var(--text-4)',
              background: 'var(--surface)', border: '1px dashed var(--line)', borderRadius: 10,
              fontSize: 12,
            }}>
              Edit instructions, then click "Run backtest" to see how the AI would score emails with your changes.
            </div>
          )}

          {backtestMutation.isPending && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <br />Running triage with draft instructions...
            </div>
          )}

          {results && (
            <div>
              {/* Summary */}
              <div style={{
                display: 'flex', gap: 16, padding: '10px 14px', marginBottom: 12,
                background: results.matches >= results.tested * 0.8 ? 'color-mix(in oklch, var(--ok) 10%, transparent)' : 'color-mix(in oklch, var(--warn) 10%, transparent)',
                border: `1px solid ${results.matches >= results.tested * 0.8 ? 'color-mix(in oklch, var(--ok) 30%, transparent)' : 'color-mix(in oklch, var(--warn) 30%, transparent)'}`,
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: results.matches >= results.tested * 0.8 ? 'var(--ok)' : 'var(--warn)' }}>
                  {results.tested > 0 ? Math.round((results.matches / results.tested) * 100) : 0}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <div>Would match <b>{results.matches}</b> of {results.tested} past decisions</div>
                  {results.mismatches > 0 && (
                    <div style={{ color: 'var(--warn)', marginTop: 2 }}>{results.mismatches} would disagree with your feedback</div>
                  )}
                </div>
              </div>

              {/* Per-email results */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10,
                overflow: 'hidden', maxHeight: 360, overflowY: 'auto',
              }}
              className="scroll"
              >
                {results.results.map((r, i) => (
                  <div key={r.email_id} style={{
                    display: 'grid', gridTemplateColumns: '20px 60px 1fr',
                    gap: 8, alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: i < results.results.length - 1 ? '1px solid var(--line-soft)' : 'none',
                    background: r.would_match ? 'transparent' : 'color-mix(in oklch, var(--warn) 6%, transparent)',
                  }}>
                    {r.would_match
                      ? <Check size={13} style={{ color: 'var(--ok)' }} />
                      : <X size={13} style={{ color: 'var(--warn)' }} />}
                    <div className="mono" style={{ fontSize: 10.5 }}>
                      <span style={{ color: 'var(--text-4)' }}>{r.old_score ?? '?'}</span>
                      <span style={{ color: 'var(--text-4)', margin: '0 3px' }}>→</span>
                      <span style={{ color: (r.new_score ?? 0) >= 50 ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>
                        {r.new_score ?? '?'}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-3)' }}>{r.sender_email.split('@')[0]}</span>
                        {' · '}
                        {r.subject}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 1 }}>
                        you {r.user_decision === 'create_task' ? 'created task' : r.user_decision + 'd'}
                        {r.reason && <> · {r.reason}</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
