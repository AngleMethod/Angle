import type { CSSProperties } from 'react'

type Direction = 'up-right' | 'down' | 'up' | 'left' | 'reset'
const paths: Record<Direction, string> = {
  'up-right': 'M5 19 19 5M5 5h14v14',
  down: 'M12 4v16M5 13l7 7 7-7',
  up: 'M12 20V4M5 11l7-7 7 7',
  left: 'M20 12H4m7-7-7 7 7 7',
  reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
}
export default function Arrow({ direction = 'up-right' }: { direction?: Direction }) {
  const style: CSSProperties = { display: 'inline-block', width: '1em', height: '1em', verticalAlign: '-0.12em', flexShrink: 0 }
  return <span aria-hidden="true" style={style}><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d={paths[direction]} /></svg></span>
}