import { TriageConfig } from './TriageConfig'
import { TriagePipeline } from './TriagePipeline'
import { TriageScoringRules } from './TriageScoringRules'
import { TriagePromptPreview } from './TriagePromptPreview'
import { TriageFeedbackHistory } from './TriageFeedbackHistory'
import { TriageBacktest } from './TriageBacktest'

export function TriageWorkbench() {
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 56px 96px' }}>
        {/* Header */}
        <header style={{ marginBottom: 32 }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 10,
            }}
          >
            AI Triage · Workbench
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            <span
              className="serif"
              style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--text-2)' }}
            >
              Teach the AI{' '}
            </span>
            what needs your attention.
          </h1>
        </header>

        {/* Section 1: Configuration */}
        <TriageConfig />

        {/* Section 2: Pipeline control */}
        <TriagePipeline />

        {/* Section 3: Scoring rules */}
        <TriageScoringRules />

        {/* Section 3: Prompt preview */}
        <TriagePromptPreview />

        {/* Section 3: Decision history */}
        <TriageFeedbackHistory />

        {/* Section 4: Backtest */}
        <TriageBacktest />
      </div>
    </div>
  )
}
