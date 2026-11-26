import { useMemo } from 'react'
import { useFormat } from '../core/format'
import { chartGeometry, type ChartPoint } from './chartGeometry'

const WIDTH = 720
const HEIGHT = 280

/** Hand-made SVG line chart; the geometry is a pure, unit-tested function. */
export function PriceChart({ points, decimals = 2, label = 'Price chart' }: { points: readonly ChartPoint[]; decimals?: number; label?: string }) {
  const fmt = useFormat()
  const g = useMemo(() => chartGeometry(points, WIDTH, HEIGHT), [points])
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      {g.yTicks.map((tick, i) => (
        <g key={i}>
          <line className="chart__grid" x1={8} x2={WIDTH - 64} y1={tick.y} y2={tick.y} />
          <text className="chart__label" x={WIDTH - 58} y={tick.y + 4}>{fmt.price(tick.value, decimals)}</text>
        </g>
      ))}
      {g.xTicks.map((tick, i) => (
        <text key={i} className="chart__label" x={tick.x} y={HEIGHT - 6} textAnchor="middle">{tick.label}</text>
      ))}
      <path className="chart__area" d={g.area} />
      <path className="chart__line" d={g.line} />
      {g.last && <circle className="chart__last" cx={g.last.x} cy={g.last.y} r={4} />}
    </svg>
  )
}
