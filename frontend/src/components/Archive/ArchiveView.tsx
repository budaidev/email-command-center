import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { api, type MonthDayStatus } from '../../api/client'

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function LegendDot({
  color,
  dashed,
  label,
}: {
  color?: string
  dashed?: boolean
  label: string
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: color || 'transparent',
          border: dashed ? '1px dashed var(--text-4)' : 'none',
        }}
      />
      {label}
    </span>
  )
}

function MiniStat({
  label,
  value,
  mono,
}: {
  label: string
  value: string | number
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
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'mono' : ''}
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text)',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function EmptyDigest({
  date,
  label,
  body,
  onGenerate,
  regenerating,
  ctaLabel,
}: {
  date: string
  label: string
  body: string
  onGenerate: () => void
  regenerating: boolean
  ctaLabel?: string
}) {
  return (
    <div style={{ padding: '32px 36px', maxWidth: 520 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <h2
        style={{
          margin: '0 0 14px',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {date}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--text-2)',
        }}
      >
        {body}
      </p>
      {ctaLabel && (
        <button
          onClick={onGenerate}
          disabled={regenerating}
          style={{
            marginTop: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderRadius: 8,
            opacity: regenerating ? 0.6 : 1,
          }}
        >
          <Sparkles size={13} />
          {regenerating ? 'Generating...' : ctaLabel}
        </button>
      )}
    </div>
  )
}

function ArchiveDetail({
  dateStr,
  dayStatus,
  digest,
  isToday,
  regenerating,
  onRegenerate,
}: {
  dateStr: string
  dayStatus: MonthDayStatus | undefined
  digest: any
  isToday: boolean
  regenerating: boolean
  onRegenerate: () => void
}) {
  const navigate = useNavigate()
  const [sy, sm, sd] = dateStr.split('-').map(Number)
  const selDate = new Date(sy, sm - 1, sd)
  const niceDate = selDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const st = dayStatus?.status || 'never'
  const emailCount = dayStatus?.emailCount || 0
  const decisionCount = dayStatus?.decisionCount || 0

  // Empty states
  if (st === 'weekend' && emailCount === 0) {
    return (
      <EmptyDigest
        date={niceDate}
        label="Quiet day"
        body="No substantial email arrived. We don't generate digests for days with nothing to summarize."
        onGenerate={onRegenerate}
        regenerating={regenerating}
      />
    )
  }
  if (st === 'never') {
    return (
      <EmptyDigest
        date={niceDate}
        label="No digest yet"
        body={`${emailCount} emails arrived this day. Generate a digest to see what happened, decisions you made, and what slipped through.`}
        onGenerate={onRegenerate}
        regenerating={regenerating}
        ctaLabel="Generate digest"
      />
    )
  }

  const content = digest?.content

  // Extract summary — handle both new format (string) and old format (object)
  let summary = 'Digest generated.'
  if (typeof content?.summary === 'string') {
    summary = content.summary
  } else if (content?.headline) {
    summary = typeof content.headline === 'string' ? content.headline : JSON.stringify(content.headline)
  } else if (typeof content?.summary === 'object' && content.summary) {
    const s = content.summary
    summary = `${s.total_emails || emailCount} emails across ${Object.keys(s.categories || {}).length} categories.`
  }

  // Extract action items / decisions — handle old and new formats
  let highlights: any[] = []
  if (Array.isArray(content?.highlights) && content.highlights[0]?.kind) {
    // New format: highlights array with kind field
    highlights = content.highlights.filter((h: any) => h.kind === 'decision')
  } else if (Array.isArray(content?.action_items)) {
    // Old format: action_items array
    highlights = content.action_items
  } else if (content?.highlights?.important_news) {
    // Very old format: highlights.important_news
    highlights = content.highlights.important_news.map((h: any) => ({
      subject: h.subject,
      action: `From ${h.sender}`,
      email_id: h.id,
    }))
  }

  // Extract categories
  let categoriesList: any[] = []
  if (Array.isArray(content?.categories)) {
    categoriesList = content.categories
  } else if (typeof content?.summary?.categories === 'object') {
    categoriesList = Object.entries(content.summary.categories).map(([name, count]) => ({
      name,
      email_count: count,
      color: 'var(--text-3)',
      summary: `${count} emails`,
    }))
  }

  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: 8,
          }}
        >
          {isToday ? 'Today · live digest' : 'Archived digest'}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {niceDate}
        </h2>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 20,
            paddingBottom: 16,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <MiniStat label="Received" value={emailCount} />
          <MiniStat label="Decisions" value={decisionCount} />
          <MiniStat
            label="Generated"
            value={
              isToday
                ? 'live'
                : dayStatus?.generatedAt
                  ? new Date(dayStatus.generatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'
            }
            mono
          />
        </div>
      </div>

      {/* Stale banner */}
      {st === 'stale' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            marginBottom: 20,
            background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
            border:
              '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
            borderRadius: 10,
          }}
        >
          <Clock
            size={14}
            style={{ color: 'var(--warn)', marginTop: 2 }}
          />
          <div
            style={{
              flex: 1,
              fontSize: 12.5,
              color: 'var(--text-2)',
              lineHeight: 1.5,
            }}
          >
            This digest was generated before new emails arrived later that day.
            Rerun to include them.
          </div>
          <button
            onClick={onRegenerate}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 500,
              background: 'var(--warn)',
              color: 'var(--bg)',
              borderRadius: 6,
            }}
          >
            Rerun
          </button>
        </div>
      )}

      {/* Summary */}
      <div
        style={{
          padding: 18,
          marginBottom: 24,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            Summary
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text)',
          }}
        >
          {summary}
        </p>
      </div>

      {/* Decisions / highlights */}
      {highlights.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 10,
            }}
          >
            Decisions made ({highlights.length})
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {highlights.map((h: any, i: number) => (
              <button
                key={i}
                onClick={() => {
                  const eid = h.emailId || h.email_id
                  if (eid) navigate(`/email/${eid}`)
                }}
                style={{
                  display: 'block',
                  textAlign: 'left',
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--surface)',
                  border: '1px solid var(--line-soft)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  {h.title || h.subject || h.action}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    lineHeight: 1.5,
                  }}
                >
                  {h.body || h.action}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Auto-handled */}
      {categoriesList.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 10,
            }}
          >
            Auto-handled
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {categoriesList.map((c: any, i: number) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  fontSize: 12.5,
                  color: 'var(--text-2)',
                  background: 'var(--surface)',
                  borderRadius: 8,
                  border: '1px solid var(--line-soft)',
                }}
              >
                <span
                  className="dot"
                  style={{ background: c.color || 'var(--text-4)' }}
                />
                {c.name}: {c.email_count} emails — {c.summary?.slice(0, 100)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          paddingTop: 18,
          borderTop: '1px solid var(--line)',
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 500,
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--line)',
            borderRadius: 7,
            opacity: regenerating ? 0.6 : 1,
          }}
        >
          <RefreshCw
            size={13}
            style={
              regenerating
                ? { animation: 'spin 1s linear infinite' }
                : undefined
            }
          />
          {regenerating
            ? 'Regenerating...'
            : isToday
              ? 'Refresh now'
              : 'Rerun digest'}
        </button>
        <button
          style={{
            padding: '7px 12px',
            fontSize: 12,
            color: 'var(--text-2)',
            border: '1px solid var(--line)',
            borderRadius: 7,
          }}
        >
          View all {emailCount} emails
        </button>
        <div style={{ flex: 1 }} />
        <button
          style={{
            padding: '7px 12px',
            fontSize: 12,
            color: 'var(--text-3)',
          }}
        >
          Export
        </button>
      </div>
    </div>
  )
}

export function ArchiveView() {
  const queryClient = useQueryClient()
  const today = new Date()
  const todayStr = fmtDate(today)
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedKey, setSelectedKey] = useState(todayStr)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const { data: monthData } = useQuery({
    queryKey: ['digest', 'month', year, month + 1],
    queryFn: () => api.getMonthStatus(year, month + 1),
  })

  const { data: digest } = useQuery({
    queryKey: ['digest', 'day', selectedKey],
    queryFn: () => api.getDailyDigest(selectedKey),
    enabled: !!selectedKey,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => api.generateDailyDigest(selectedKey, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digest', 'day', selectedKey] })
      queryClient.invalidateQueries({
        queryKey: ['digest', 'month', year, month + 1],
      })
    },
  })

  const dayStatusMap = new Map<string, MonthDayStatus>()
  if (monthData) {
    for (const d of monthData) {
      dayStatusMap.set(d.date, d)
    }
  }

  // Build grid
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d))
  while (grid.length % 7 !== 0) grid.push(null)

  const selectedDayStatus = dayStatusMap.get(selectedKey)
  const isSelectedToday = selectedKey === todayStr
  const monthLabel = cursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        overflow: 'hidden',
      }}
    >
      {/* Calendar grid */}
      <div
        style={{
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '24px 32px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: 8,
            }}
          >
            Digest archive
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '-0.025em',
              }}
            >
              {monthLabel}
            </h1>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setCursor(new Date(year, month - 1, 1))}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  color: 'var(--text-2)',
                }}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setCursor(new Date(year, month + 1, 1))}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  color: 'var(--text-2)',
                }}
              >
                <ChevronRight size={13} />
              </button>
              <button
                onClick={() => {
                  setCursor(
                    new Date(today.getFullYear(), today.getMonth(), 1)
                  )
                  setSelectedKey(todayStr)
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  color: 'var(--text-2)',
                  marginLeft: 4,
                }}
              >
                Today
              </button>
            </div>
          </div>
        </div>

        <div
          className="scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}
        >
          {/* Weekday headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
              marginBottom: 8,
            }}
          >
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <div
                key={d}
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: 'var(--text-4)',
                  padding: '4px 8px',
                  textAlign: 'left',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
            }}
          >
            {grid.map((d, i) => {
              if (!d) return <div key={i} />
              const key = fmtDate(d)
              const rec = dayStatusMap.get(key)
              const isTodayCell = key === todayStr
              const isFuture = d > today
              const isSelected = key === selectedKey
              const st = rec?.status || (isFuture ? 'future' : 'never')

              const dotColor =
                st === 'ready'
                  ? 'var(--ok)'
                  : st === 'today'
                    ? 'var(--accent)'
                    : st === 'stale'
                      ? 'var(--warn)'
                      : st === 'weekend'
                        ? 'var(--text-4)'
                        : 'transparent'

              const statusLabel =
                st === 'ready'
                  ? 'Digest'
                  : st === 'today'
                    ? 'Live'
                    : st === 'stale'
                      ? 'Outdated'
                      : st === 'weekend'
                        ? 'Quiet'
                        : 'Not run'

              return (
                <button
                  key={i}
                  onClick={() => !isFuture && setSelectedKey(key)}
                  disabled={isFuture}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    minHeight: 82,
                    borderRadius: 10,
                    background: isSelected
                      ? 'var(--surface-2)'
                      : isTodayCell
                        ? 'var(--accent-soft)'
                        : 'var(--surface)',
                    border: `1px solid ${
                      isSelected || isTodayCell
                        ? 'var(--accent)'
                        : 'var(--line-soft)'
                    }`,
                    opacity: isFuture ? 0.35 : 1,
                    cursor: isFuture ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'all .14s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: isTodayCell ? 600 : 500,
                        color: isTodayCell
                          ? 'var(--accent)'
                          : 'var(--text)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {d.getDate()}
                    </span>
                    {rec && rec.emailCount > 0 && !isFuture && (
                      <span
                        className="mono"
                        style={{ fontSize: 10, color: 'var(--text-3)' }}
                      >
                        {rec.emailCount}
                      </span>
                    )}
                  </div>
                  {!isFuture && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: dotColor,
                          border:
                            st === 'never'
                              ? '1px dashed var(--text-4)'
                              : 'none',
                        }}
                      />
                      <span
                        style={{ fontSize: 10, color: 'var(--text-3)' }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  )}
                  {rec &&
                    rec.decisionCount > 0 &&
                    !isFuture && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--accent)',
                        }}
                      />
                    )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              marginTop: 20,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--line-soft)',
              borderRadius: 10,
              display: 'flex',
              gap: 18,
              flexWrap: 'wrap',
              fontSize: 11,
              color: 'var(--text-3)',
            }}
          >
            <LegendDot color="var(--accent)" label="Today (live)" />
            <LegendDot color="var(--ok)" label="Digest ready" />
            <LegendDot color="var(--warn)" label="Outdated — rerun" />
            <LegendDot dashed label="Not generated" />
            <LegendDot color="var(--text-4)" label="Quiet day" />
          </div>
        </div>
      </div>

      {/* Right: digest detail */}
      <div className="scroll" style={{ overflowY: 'auto' }}>
        <ArchiveDetail
          dateStr={selectedKey}
          dayStatus={selectedDayStatus}
          digest={digest}
          isToday={isSelectedToday}
          regenerating={regenerateMutation.isPending}
          onRegenerate={() => regenerateMutation.mutate()}
        />
      </div>
    </div>
  )
}
