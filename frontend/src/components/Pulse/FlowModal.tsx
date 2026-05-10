import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  kicker?: string
  tone?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function FlowModal({ title, kicker, tone, onClose, children, footer }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '8vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620, maxHeight: '80vh',
          background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 14,
          boxShadow: 'var(--shadow)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '14px 20px 12px',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div style={{ flex: 1 }}>
            {kicker && (
              <div
                className="mono"
                style={{
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: tone || 'var(--text-3)', marginBottom: 3,
                }}
              >
                {kicker}
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-3)', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </header>
        <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
        {footer && (
          <footer style={{ padding: '10px 20px', borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
