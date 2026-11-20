import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { FeedbackButton, VerdictFeedbackForm, VERDICT_LABEL } from './VerdictFeedback'

// Reading view: the email's verdict and the "Rossz besorolás" correction, for any
// email, also the ones on no review list (the misses).
export function EmailVerdict({ emailId }: { emailId: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['feedback', emailId], queryFn: () => api.getFeedback(emailId) })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const d = q.data
  if (!d) return null
  return (
    <div style={{ margin: '-8px 0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap' }}>
        <span>Besorolás: <b style={{ color: 'var(--text-2)' }}>{d.predicted ? VERDICT_LABEL[d.predicted] : 'nincs értékelve'}</b>
          {d.why && <span> · {d.why}</span>}</span>
        {d.feedback && (
          <span style={{ color: 'var(--text-2)' }}>
            · szerinted <b>{VERDICT_LABEL[d.feedback.verdict]}</b>{d.feedback.note ? ` („${d.feedback.note}”)` : ''}
          </span>
        )}
        <FeedbackButton active={open} onClick={() => setOpen(v => !v)} />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
      {open && (
        <VerdictFeedbackForm emailId={emailId} predicted={d.predicted} initial={d.feedback} onError={setError}
          onCancel={() => setOpen(false)}
          onSaved={r => { setOpen(false); setError(null); qc.setQueryData(['feedback', emailId], r); qc.invalidateQueries({ queryKey: ['feedback-report'] }) }} />
      )}
    </div>
  )
}
