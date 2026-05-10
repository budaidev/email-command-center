import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, AlertCircle, Sparkles, MapPin, Clock } from 'lucide-react'
import { useState } from 'react'
import { api, DailyDigest, DigestActionItem } from '../../api/client'

interface Props {
  date: string
  onSelectEmail?: (emailId: string) => void
}

export function DailyDigestDetail({ date, onSelectEmail }: Props) {
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)

  const { data: events } = useQuery({
    queryKey: ['calendar-events', date],
    queryFn: () => api.getCalendarEvents(date),
  })

  const { data: digest, isLoading } = useQuery({
    queryKey: ['daily-digest', date],
    queryFn: () => api.getDailyDigest(date),
    refetchInterval: (query) => {
      const d = query.state.data as DailyDigest | undefined
      return d?.status === 'generating' ? 2000 : false
    },
  })

  const handleGenerate = async (force = false) => {
    setGenerating(true)
    try {
      await api.generateDailyDigest(date, force)
      queryClient.invalidateQueries({ queryKey: ['daily-digest', date] })
      queryClient.invalidateQueries({ queryKey: ['daily-digests-calendar'] })
    } finally {
      setGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    )
  }

  const status = digest?.status || 'none'
  const content = digest?.content

  // No digest or pending
  if (status === 'none' || status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
        <Sparkles className="w-8 h-8 opacity-30" />
        <p className="text-sm">No digest for {date}</p>
        <button
          onClick={() => handleGenerate()}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Summary
        </button>
      </div>
    )
  }

  // Generating
  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-yellow-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Generating digest...</p>
      </div>
    )
  }

  // Error
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400">
        <AlertCircle className="w-8 h-8 opacity-50" />
        <p className="text-sm">Generation failed</p>
        {digest?.error_msg && <p className="text-xs text-gray-600 max-w-md text-center">{digest.error_msg}</p>}
        <button
          onClick={() => handleGenerate(true)}
          disabled={generating}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Retry
        </button>
      </div>
    )
  }

  // Complete — render full digest
  return (
    <div className="h-full overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{date}</h2>
          {digest?.headline && <p className="text-sm text-gray-400 mt-1">{digest.headline}</p>}
          <p className="text-xs text-gray-600 mt-1">{digest?.email_count} emails</p>
        </div>
        <button
          onClick={() => handleGenerate(true)}
          disabled={generating}
          className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
          title="Regenerate"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {/* Calendar Events */}
      {events && events.length > 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Calendar Events</h3>
          <div className="space-y-1.5">
            {events.map(ev => {
              const time = ev.all_day
                ? 'All day'
                : new Date(ev.dtstart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={ev.id} className="flex items-start gap-2 bg-gray-900/50 rounded px-2.5 py-2 border border-gray-800/50">
                  <Clock className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-400 font-medium">{time}</span>
                      <span className="text-sm text-gray-300">{ev.summary || '(no title)'}</span>
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-gray-600" />
                        <span className="text-[10px] text-gray-600">{ev.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Highlights */}
      {content?.highlights && content.highlights.length > 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Highlights</h3>
          <ul className="space-y-1">
            {content.highlights.map((h, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 shrink-0">-</span>
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Action Items */}
      {content?.action_items && content.action_items.length > 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Action Items</h3>
          <ul className="space-y-2">
            {content.action_items.map((a, i) => {
              const item: DigestActionItem | null = typeof a === 'object' ? a : null
              const text = item ? item.action : String(a)
              return (
              <li key={i} className="bg-gray-900/50 rounded-lg p-2.5 border border-gray-800/50">
                <p className="text-sm text-yellow-400/80">{text}</p>
                {item && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600 truncate">
                      {item.sender} — {item.subject}
                    </span>
                    {item.email_id && onSelectEmail && (
                      <button
                        onClick={() => onSelectEmail(item.email_id)}
                        className="text-[10px] text-blue-500 hover:text-blue-400 transition-colors shrink-0"
                      >
                        View email
                      </button>
                    )}
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Categories */}
      {content?.categories && content.categories.length > 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">By Category</h3>
          <div className="space-y-3">
            {content.categories.map((cat, i) => (
              <div key={i} className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                  <span className="text-sm font-medium text-gray-200">{cat.name}</span>
                  <span className="text-xs text-gray-600">{cat.email_count} emails</span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{cat.summary}</p>
                {cat.top_subjects && cat.top_subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cat.top_subjects.map((s, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Uncategorized */}
      {content?.uncategorized && content.uncategorized.email_count > 0 && (
        <section className="mb-5">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
              <span className="text-sm font-medium text-gray-200">Uncategorized</span>
              <span className="text-xs text-gray-600">{content.uncategorized.email_count} emails</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">{content.uncategorized.summary}</p>
            {content.uncategorized.top_subjects && content.uncategorized.top_subjects.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {content.uncategorized.top_subjects.map((s, j) => (
                  <span key={j} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Meta */}
      {digest?.generated_at && (
        <p className="text-[10px] text-gray-700 mt-4">
          Generated {new Date(digest.generated_at).toLocaleString()}
          {digest.model && ` with ${digest.model}`}
        </p>
      )}
    </div>
  )
}
