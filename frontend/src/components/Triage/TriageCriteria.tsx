import type { TriageCriterion, TriageResult } from '../../api/client'

const LABELS: Record<string, string> = {
  reply_or_decision: 'Reply or decision needed',
  mandatory_appointment: 'Mandatory appointment',
  payment_due: 'Payment due',
}

/** Why the importance rubric (card #239) flagged an email: each "yes" with its quote. */
export function TriageCriteria({ item }: { item: Pick<TriageResult, 'criteria' | 'prompt_version' | 'model' | 'status'> }) {
  if (!item.criteria) return null
  let parsed: Record<string, TriageCriterion | string | null>
  try { parsed = JSON.parse(item.criteria) } catch { return null }
  const yes = Object.entries(LABELS)
    .map(([key, label]) => ({ key, label, c: parsed[key] as TriageCriterion | undefined }))
    .filter(x => x.c?.answer)

  return (
    <div style={{ margin: '0 0 8px', fontSize: 12, lineHeight: 1.5, color: 'var(--text-2)', maxWidth: 620 }}>
      {yes.length === 0 && <div style={{ color: 'var(--text-3)' }}>No criterion met{parsed.kind ? ` (${parsed.kind})` : ''}.</div>}
      {yes.map(({ key, label, c }) => (
        <div key={key} style={{ marginBottom: 2 }}>
          <b style={{ fontWeight: 600 }}>{label}:</b>{' '}
          <span style={{ fontStyle: 'italic' }}>“{c!.evidence}”</span>
          {c!.evidence_found === false && (
            <span title="This quote is not in the email word for word" style={{ marginLeft: 6, color: 'var(--warn, #b45309)' }}>
              (quote not found in the email)
            </span>
          )}
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
        {item.prompt_version}{item.model ? ` · ${item.model}` : ''}
      </div>
    </div>
  )
}
