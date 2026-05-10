import type { ReactNode } from 'react'

interface ColumnProps {
  col: { id: string; label: string; kicker: string }
  count: number
  isDropTarget: boolean
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  children: ReactNode
}

export function Column({ col, count, isDropTarget, onDragOver, onDrop, children }: ColumnProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: isDropTarget ? 'var(--accent-soft)' : 'transparent',
        borderRadius: 12,
        padding: 2,
        transition: 'background .14s',
      }}
    >
      <div
        style={{
          padding: '6px 10px 10px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {col.label}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {count}
        </span>
        <div style={{ flex: 1 }} />
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-4)',
          }}
        >
          {col.kicker}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
        {children}
      </div>
    </div>
  )
}
