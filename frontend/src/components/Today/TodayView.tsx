import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Avatar } from '../shared/Avatar'
import { GtdPulseWidget } from './GtdPulseWidget'
import { TriageEmailCard } from './TriageEmailCard'

function Stat({
  label,
  value,
  hint,
  accent,
  mono,
}: {
  label: string
  value: string | number
  hint: string
  accent?: string
  mono?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'mono' : ''}
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: accent || 'var(--text)',
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{hint}</div>
    </div>
  )
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          marginBottom: 4,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.015em',
        }}
      >
        {title}
      </h2>
    </div>
  )
}

export function TodayView() {
  const navigate = useNavigate()

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['digest', 'today'],
    queryFn: api.getTodayBriefing,
    refetchInterval: 60_000,
  })

  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: triageData } = useQuery({
    queryKey: ['triage', today],
    queryFn: () => api.getTriageResults({ min_score: 50, limit: 10, date: today }),
    refetchInterval: 60_000,
  })

  const triageItems = (triageData?.results ?? []).filter(r => !r.feedback_decision)

  // Today's emails ranked by score, paginated 5 at a time
  const [summaryPage, setSummaryPage] = useState(0)
  const PAGE_SIZE = 5

  const { data: summaryData } = useQuery({
    queryKey: ['triage', 'summary', today, summaryPage],
    queryFn: () => api.getTriageResults({ min_score: 0, limit: PAGE_SIZE, offset: summaryPage * PAGE_SIZE, date: today }),
    refetchInterval: 60_000,
  })

  const summaryEmails = summaryData?.results ?? []
  const summaryTotal = summaryData?.total ?? 0

  const feedbackMutation = useMutation({
    mutationFn: ({ emailId, decision }: { emailId: string; decision: 'approve' | 'dismiss' | 'create_task' }) =>
      api.submitTriageFeedback(emailId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['triage'] }),
  })

  const createTaskMutation = useMutation({
    mutationFn: ({ emailId, title }: { emailId: string; title: string }) =>
      api.createTaskFromEmail(emailId, { title, col: 'inbox' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    )
  }

  const d = briefing ?? {
    date: new Date().toISOString().split('T')[0],
    arrived: 0,
    handled: 0,
    remaining: 0,
    highlights: [],
    fyi: [],
    generatedAt: null,
  }

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })


  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          padding: '48px 56px 80px',
        }}
      >
        {/* Masthead */}
        <header style={{ marginBottom: 40 }}>
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
            {dateLabel} · morning briefing
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              maxWidth: 760,
            }}
          >
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--text-2)',
                fontSize: 42,
              }}
            >
              Good morning.
            </span>
            <br />
            You have{' '}
            <span style={{ color: 'var(--accent)' }}>
              {triageItems.length} item{triageItems.length !== 1 ? 's' : ''}
            </span>{' '}
            that need your attention.
          </h1>

          {/* Stats row */}
          <div
            style={{
              marginTop: 32,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 24,
              paddingTop: 24,
              borderTop: '1px solid var(--line)',
            }}
          >
            <Stat label="Arrived" value={d.arrived} hint="since 6 am" />
            <Stat
              label="Auto-handled"
              value={d.handled}
              hint="filed by rules"
              accent="var(--ok)"
            />
            <Stat
              label="For you"
              value={triageItems.length}
              hint="needs attention"
              accent="var(--accent)"
            />
            <Stat label="Next sync" value="in 4m" hint="every 5 min" mono />
          </div>
        </header>

        {/* Needs your attention — AI triage */}
        {triageItems.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionTitle
              kicker="01 · Needs your attention"
              title="AI-scored emails awaiting action"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {triageItems.map((item) => (
                <TriageEmailCard
                  key={item.email_id}
                  item={item}
                  onApprove={() => feedbackMutation.mutate({ emailId: item.email_id, decision: 'approve' })}
                  onDismiss={() => feedbackMutation.mutate({ emailId: item.email_id, decision: 'dismiss' })}
                  onCreateTask={() => {
                    feedbackMutation.mutate({ emailId: item.email_id, decision: 'create_task' })
                    if (item.suggested_task) {
                      createTaskMutation.mutate({ emailId: item.email_id, title: item.suggested_task })
                    } else {
                      navigate(`/email/${item.email_id}`)
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Today's emails ranked by relevance, paginated */}
        {(summaryEmails.length > 0 || summaryPage > 0) && (
          <section style={{ marginBottom: 48 }}>
            <SectionTitle
              kicker={`02 · Today's summary · ${summaryTotal} emails`}
              title="Ranked by relevance"
            />
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line-soft)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {summaryEmails.map((e, i) => {
                const scoreColor = e.score >= 76 ? 'var(--danger)' : e.score >= 51 ? 'var(--warn)' : 'var(--text-4)'
                return (
                  <button
                    key={e.email_id}
                    onClick={() => navigate(`/email/${e.email_id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 18px',
                      borderBottom: i < summaryEmails.length - 1 ? '1px solid var(--line-soft)' : 'none',
                      background: 'transparent',
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 0',
                        color: scoreColor,
                        textAlign: 'center',
                      }}
                    >
                      {e.score}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.sender_name || e.sender_email}
                        {' · '}
                        <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
                          {e.subject}
                        </span>
                      </div>
                      {e.reason && (
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-3)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {e.reason}
                        </div>
                      )}
                    </div>
                    {e.category_name && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: e.category_color || 'var(--text-3)',
                          fontWeight: 500,
                        }}
                      >
                        {e.category_name}
                      </span>
                    )}
                  </button>
                )
              })}
              {/* Pagination */}
              {summaryTotal > PAGE_SIZE && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '10px 18px',
                    borderTop: '1px solid var(--line-soft)',
                  }}
                >
                  <button
                    onClick={() => setSummaryPage(p => Math.max(0, p - 1))}
                    disabled={summaryPage === 0}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      color: 'var(--text-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      opacity: summaryPage === 0 ? 0.4 : 1,
                    }}
                  >
                    ← Prev
                  </button>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--text-3)' }}
                  >
                    {summaryPage * PAGE_SIZE + 1}–{Math.min((summaryPage + 1) * PAGE_SIZE, summaryTotal)} of {summaryTotal}
                  </span>
                  <button
                    onClick={() => setSummaryPage(p => p + 1)}
                    disabled={(summaryPage + 1) * PAGE_SIZE >= summaryTotal}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      color: 'var(--text-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      opacity: (summaryPage + 1) * PAGE_SIZE >= summaryTotal ? 0.4 : 1,
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* GTD Pulse */}
        <section style={{ marginTop: 48 }}>
          <div style={{ marginBottom: 16 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--text-3)',
                marginBottom: 4,
              }}
            >
              03 · GTD pulse
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em' }}>
              How your task system is doing
            </h2>
          </div>
          <GtdPulseWidget />
        </section>
      </div>
    </div>
  )
}
