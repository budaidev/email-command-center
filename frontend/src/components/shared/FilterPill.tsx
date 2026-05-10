import { type ReactNode } from 'react'

interface Props {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  color?: string
}

export function FilterPill({ children, active, onClick, color }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        background: active ? 'var(--text)' : 'var(--surface)',
        color: active ? 'var(--bg)' : 'var(--text-2)',
        border: active ? 'none' : '1px solid var(--line)',
        transition: 'all .14s',
      }}
    >
      {color && <span className="dot" style={{ background: color }} />}
      {children}
    </button>
  )
}
