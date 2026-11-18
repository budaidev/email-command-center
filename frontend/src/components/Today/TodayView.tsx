import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
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
    refetchInterval: (query) =>
      query.state.data?.digestStatus === 'generating' ? 2_000 : 60_000,
  })

  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const regenerateMutation = useMutation({
    mutationFn: () => api.generateDailyDigest(today, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['digest', 'today'] }),
  })

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

        <DigestStatusBanner
          status={briefing?.digestStatus ?? null}
          error={briefing?.digestError ?? null}
          arrived={d.arrived}
          onRetry={() => regenerateMutation.mutate()}
          retrying={regenerateMutation.isPending}
        />

        {/* AI-generated digest summary */}
        {briefing?.digestStatus === 'complete' && (briefing.summary || briefing.highlights.length > 0 || briefing.fyi.length > 0) && (
          <section style={{ marginBottom: 48 }}>
            <SectionTitle kicker="00 · Daily digest" title="Today at a glance" />
            {briefing.summary && (
              <p
                className="serif"
                style={{
                  fontSize: 17,
                  lineHeight: 1.55,
                  color: 'var(--text-2)',
                  margin: '0 0 24px',
                  maxWidth: 760,
                }}
              >
                {briefing.summary}
              </p>
            )}
            {briefing.highlights.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: briefing.fyi.length > 0 ? 20 : 0 }}>
                {briefing.highlights.map((h, i) => {
                  const accent = h.kind === 'decision' ? 'var(--accent)' : 'var(--text-3)'
                  const clickable = !!h.emailId
                  return (
                    <button
                      key={i}
                      onClick={() => h.emailId && navigate(`/email/${h.emailId}`)}
                      disabled={!clickable}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '4px 1fr',
                        gap: 14,
                        padding: '12px 16px',
                        background: 'var(--surface)',
                        border: '1px solid var(--line-soft)',
                        borderRadius: 8,
                        textAlign: 'left',
                        cursor: clickable ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{ background: accent, borderRadius: 2 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                          {h.title}
                        </div>
                        {h.body && (
                          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.45 }}>{h.body}</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {briefing.fyi.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {briefing.fyi.map((f, i) => (
                  <li
                    key={i}
                    onClick={() => f.emailId && navigate(`/email/${f.emailId}`)}
                    style={{
                      fontSize: 12,
                      color: 'var(--text-3)',
                      padding: '4px 0',
                      cursor: f.emailId ? 'pointer' : 'default',
                    }}
                  >
                    <span className="mono" style={{ color: 'var(--text-4)', marginRight: 8 }}>
                      {f.kind === 'auto' ? 'AUTO' : 'FYI '}
                    </span>
                    {f.title}
                    {f.count !== undefined && (
                      <span style={{ color: 'var(--text-4)', marginLeft: 6 }}>({f.count})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {briefing.generatedAt && (
              <div
                className="mono"
                style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 18, letterSpacing: '0.05em' }}
              >
                Generated {new Date(briefing.generatedAt + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </section>
        )}

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

function DigestStatusBanner({
  status,
  error,
  arrived,
  onRetry,
  retrying,
}: {
  status: 'generating' | 'complete' | 'error' | null
  error: string | null
  arrived: number
  onRetry: () => void
  retrying: boolean
}) {
  if (status === 'complete' || status === null) return null
  if (arrived === 0) return null

  const palette =
    status === 'error'
      ? { fg: 'var(--danger)', bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.25)' }
      : { fg: 'var(--warn)', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.25)' }

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '14px 18px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {status === 'generating' ? (
        <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: palette.fg, flexShrink: 0 }} />
      ) : (
        <AlertCircle style={{ width: 18, height: 18, color: palette.fg, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: palette.fg }}>
          {status === 'generating' ? 'Generating today’s digest…' : 'Digest generation failed'}
        </div>
        {status === 'error' && error && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{error}</div>
        )}
        {status === 'generating' && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            Highlights below are a fallback until the AI summary is ready.
          </div>
        )}
      </div>
      {status === 'error' && (
        <button
          onClick={onRetry}
          disabled={retrying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 6,
            cursor: retrying ? 'wait' : 'pointer',
            opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? (
            <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
          ) : (
            <RefreshCw style={{ width: 12, height: 12 }} />
          )}
          Retry
        </button>
      )}
    </div>
  )
}
