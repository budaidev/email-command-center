import { Sparkles } from 'lucide-react'

interface Props {
  options: string[]
  value?: string | null
  onPick: (option: string) => void
  onDismiss?: () => void
  label?: string
}

export function SuggestionChips({
  options,
  value = null,
  onPick,
  onDismiss,
  label = 'AI suggestions',
}: Props) {
  if (!options || options.length === 0) return null

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        background: 'var(--accent-ai-soft)',
        border: '1px solid color-mix(in oklch, var(--accent-ai) 24%, transparent)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <Sparkles size={11} style={{ color: 'var(--accent-ai)' }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-ai)',
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1 }} />
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            Dismiss
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map((opt, i) => {
          const isActive = value === opt
          return (
            <button
              key={i}
              onClick={() => onPick(opt)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 7,
                background: isActive ? 'var(--surface)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--accent-ai)' : 'transparent'}`,
                color: 'var(--text)',
                fontSize: 12.5,
                lineHeight: 1.4,
                transition: 'all .14s',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  marginTop: 2,
                  borderRadius: 7,
                  border: `1.5px solid ${isActive ? 'var(--accent-ai)' : 'var(--text-4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isActive && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--accent-ai)',
                    }}
                  />
                )}
              </span>
              <span>{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
