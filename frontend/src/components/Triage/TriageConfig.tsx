import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Play, Loader2, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'

export function TriageConfig() {
  const queryClient = useQueryClient()
  const { data: prefs } = useQuery({ queryKey: ['triage', 'preferences'], queryFn: api.getTriagePreferences })

  const [instructions, setInstructions] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (prefs) { setInstructions(prefs.instructions); setEnabled(prefs.enabled) }
  }, [prefs])

  const saveMutation = useMutation({
    mutationFn: () => api.updateTriagePreferences({ instructions, enabled }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['triage'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })
  const runMutation = useMutation({
    mutationFn: () => api.runTriage(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage'] }),
  })
  const summarizeMutation = useMutation({
    mutationFn: () => api.summarizeTriagePreferences(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage', 'preferences'] }),
  })

  const totalFeedback = prefs?.stats?.reduce((s, r) => s + r.count, 0) ?? 0
  const statMap = Object.fromEntries((prefs?.stats ?? []).map(s => [s.decision, s.count]))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
      {/* Left: Instructions */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
          Your instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          style={{
            width: '100%', padding: 10, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)',
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8,
            outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
          <div style={{ flex: 1 }} />
          <button onClick={() => saveMutation.mutate()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
            background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 6,
          }}>
            <Save size={11} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5, fontWeight: 500,
            color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6,
          }}>
            {runMutation.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={11} />}
            {runMutation.isPending ? 'Running...' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Right: Learned profile + stats */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
          What the AI learned
        </label>
        {prefs?.learnedProfile ? (
          <div style={{
            padding: 10, fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)',
            background: 'var(--accent-ai-soft)', border: '1px solid color-mix(in oklch, var(--accent-ai) 24%, transparent)',
            borderRadius: 8, minHeight: 80,
          }}>
            {prefs.learnedProfile}
          </div>
        ) : (
          <div style={{
            padding: 10, fontSize: 12, color: 'var(--text-4)',
            background: 'var(--surface-2)', borderRadius: 8, fontStyle: 'italic', minHeight: 80,
          }}>
            No learned preferences yet. Approve/dismiss emails on the Today page to train the AI.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
            <span><b style={{ color: 'var(--ok)' }}>{statMap.approve ?? 0}</b> approved</span>
            <span><b>{statMap.dismiss ?? 0}</b> dismissed</span>
            <span><b style={{ color: 'var(--accent-ai)' }}>{statMap.create_task ?? 0}</b> tasks</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => summarizeMutation.mutate()} disabled={summarizeMutation.isPending || totalFeedback < 5} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 500,
            color: 'var(--text-2)', border: '1px solid var(--line)', borderRadius: 6, opacity: totalFeedback < 5 ? 0.5 : 1,
          }}>
            {summarizeMutation.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />}
            Re-learn
          </button>
        </div>
      </div>
    </div>
  )
}
