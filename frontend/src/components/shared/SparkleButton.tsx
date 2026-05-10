import { Sparkles } from 'lucide-react'

interface Props {
  loading?: boolean
  onClick: () => void
  title?: string
  size?: number
}

export function SparkleButton({
  loading = false,
  onClick,
  title = 'Rewrite with AI',
  size = 14,
}: Props) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 7,
        background: 'var(--accent-ai-soft)',
        color: 'var(--accent-ai)',
        border: '1px solid color-mix(in oklch, var(--accent-ai) 30%, transparent)',
        transition: 'transform .14s, background .14s',
        opacity: loading ? 0.7 : 1,
      }}
    >
      <Sparkles
        size={size}
        style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined}
      />
    </button>
  )
}
