import { sparklinePoints } from './chartGeometry'

/** Inline SVG sparkline: a pure function of its props. */
export function Sparkline({ values }: { values: readonly number[] }) {
  const rising = values.length < 2 || values[values.length - 1] >= values[0]
  return (
    <svg
      className={`sparkline ${rising ? 'up' : 'down'}`}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      role="img"
      aria-label={rising ? 'Rising' : 'Falling'}
    >
      <polyline points={sparklinePoints(values)} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
