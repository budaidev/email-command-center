import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Play, X } from 'lucide-react'
import { api } from '../../api/client'
import { DatePicker } from './DatePicker'

interface Props {
  onClose: () => void
}

export function BackfillControls({ onClose }: Props) {
  const queryClient = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [starting, setStarting] = useState(false)
  const [result, setResult] = useState<{ queued: number; already_complete: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: status } = useQuery({
    queryKey: ['backfill-status'],
    queryFn: api.getBackfillStatus,
    refetchInterval: (query) => {
      return query.state.data?.running ? 3000 : false
    },
  })

  const isRunning = status?.running ?? false

  // Refresh calendar data when backfill completes
  const prevRunning = status?.running
  if (prevRunning === false && result) {
    queryClient.invalidateQueries({ queryKey: ['daily-digests-calendar'] })
  }

  const handleStart = async () => {
    if (!from || !to) return
    if (from > to) {
      setError('"From" date must be before "To" date')
      return
    }
    setStarting(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.startBackfill(from, to)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['backfill-status'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start backfill')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Backfill Digests</h3>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isRunning && (
        <div className="flex items-end gap-3">
          <DatePicker label="From" value={from} onChange={setFrom} />
          <DatePicker label="To" value={to} onChange={setTo} />
          <button
            onClick={handleStart}
            disabled={!from || !to || starting}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {starting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Generate All
          </button>
        </div>
      )}

      {isRunning && status && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              Generating {status.current_date}...
            </span>
            <span>{status.completed} of {status.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${status.total > 0 ? (status.completed / status.total) * 100 : 0}%` }}
            />
          </div>
          {status.errors.length > 0 && (
            <p className="text-[10px] text-red-400">{status.errors.length} error(s)</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {!isRunning && result && (
        <p className="text-xs text-gray-500">
          Queued {result.queued} digests ({result.already_complete} already existed)
        </p>
      )}
    </div>
  )
}
