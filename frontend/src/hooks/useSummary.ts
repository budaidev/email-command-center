import { useState, useEffect, useRef } from 'react'

export interface EmailRef {
  id: string
  type: 'action' | 'date' | 'contact' | 'amount' | 'link'
  content: string
  due_date: string | null
}

interface SummaryState {
  content: string
  isStreaming: boolean
  error: string | null
  refs: EmailRef[]
}

export function useSummary(emailId: string | null, enabled = true) {
  const [state, setState] = useState<SummaryState>({
    content: '',
    isStreaming: false,
    error: null,
    refs: [],
  })
  const esRef = useRef<EventSource | null>(null)

  function start(forceRefresh = false) {
    if (!emailId || !enabled) return

    // Close any existing stream
    esRef.current?.close()

    setState({ content: '', isStreaming: true, error: null, refs: [] })

    const url = `/api/summaries/stream?type=email&id=${emailId}${forceRefresh ? '&refresh=1' : ''}`
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('chunk', (e) => {
      const data = JSON.parse(e.data)
      setState(prev => ({ ...prev, content: prev.content + data.content }))
    })

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data)
      setState(prev => ({ ...prev, isStreaming: false, refs: data.refs || [] }))
      es.close()
    })

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data)
        setState(prev => ({ ...prev, isStreaming: false, error: data.error || 'Summary failed' }))
      } catch {
        setState(prev => ({ ...prev, isStreaming: false, error: 'Connection error' }))
      }
      es.close()
    })

    // Connection-level error (server unreachable etc.)
    es.onerror = () => {
      setState(prev => {
        if (prev.isStreaming) return { ...prev, isStreaming: false, error: 'Connection lost' }
        return prev
      })
      es.close()
    }
  }

  useEffect(() => {
    if (!emailId || !enabled) {
      esRef.current?.close()
      setState({ content: '', isStreaming: false, error: null, refs: [] })
      return
    }
    start()
    return () => esRef.current?.close()
  }, [emailId, enabled])

  return { ...state, refresh: () => start(true) }
}
