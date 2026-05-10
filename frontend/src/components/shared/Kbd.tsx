import { type ReactNode, type CSSProperties } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
}

export function Kbd({ children, style }: Props) {
  return <span className="kbd" style={style}>{children}</span>
}
