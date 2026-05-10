interface Props {
  name: string
  size?: number
  color?: string
}

export function Avatar({ name, size = 28, color }: Props) {
  const initials = (name || '?')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360
  }
  const bg = color || `oklch(0.42 0.06 ${h})`

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 34 ? 10 : 8,
        background: bg,
        color: 'white',
        fontSize: size * 0.38,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
