import { useMemo } from 'react'
import { useFormat } from '../core/format'
import { candleGeometry, type IndicatorFlags, type OhlcCandle } from './candleGeometry'

const WIDTH = 720
const HEIGHT = 340

/** Candlestick chart with optional SMA/EMA overlays and an RSI pane. Pure SVG, no chart library. */
export function CandleChart({ candles, indicators, decimals = 2, label = 'Candlestick chart' }: {
  candles: readonly OhlcCandle[]
  indicators: IndicatorFlags
  decimals?: number
  label?: string
}) {
  const fmt = useFormat()
  const g = useMemo(() => candleGeometry(candles, WIDTH, HEIGHT, indicators), [candles, indicators])
  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      {g.yTicks.map((tick, i) => (
        <g key={`y${i}`}>
          <line className="chart__grid" x1={8} x2={WIDTH - 64} y1={tick.y} y2={tick.y} />
          <text className="chart__label" x={WIDTH - 58} y={tick.y + 4}>{fmt.price(tick.value, decimals)}</text>
        </g>
      ))}
      {g.xTicks.map((tick, i) => (
        <text key={`x${i}`} className="chart__label" x={tick.x} y={HEIGHT - 6} textAnchor="middle">{tick.label}</text>
      ))}
      {g.wicks.map((w, i) => (
        <line key={`w${i}`} className={`wick ${w.up ? 'candle--up' : 'candle--down'}`} x1={w.x} x2={w.x} y1={w.y1} y2={w.y2} />
      ))}
      {g.bodies.map((b, i) => (
        <rect key={`b${i}`} className={b.up ? 'candle--up' : 'candle--down'} x={b.x} y={b.y} width={b.w} height={b.h} />
      ))}
      {g.sma && <path className="ind-sma" d={g.sma} />}
      {g.ema && <path className="ind-ema" d={g.ema} />}
      {g.last && (
        <>
          <line className="chart__grid" x1={8} x2={WIDTH - 64} y1={g.last.y} y2={g.last.y} style={{ stroke: 'var(--tc-accent)' }} />
          <text className="chart__label" x={WIDTH - 58} y={g.last.y + 4} style={{ fill: 'var(--tc-accent)', fontWeight: 700 }}>
            {fmt.price(g.last.value, decimals)}
          </text>
        </>
      )}
      {indicators.rsi && (
        <>
          <line className="pane-sep" x1={8} x2={WIDTH - 64} y1={g.rsiTop - 6} y2={g.rsiTop - 6} />
          <rect className="rsi-band" x={8} width={WIDTH - 72} y={g.rsiY(70)} height={g.rsiY(30) - g.rsiY(70)} />
          <text className="chart__label" x={WIDTH - 58} y={g.rsiY(70) + 4}>70</text>
          <text className="chart__label" x={WIDTH - 58} y={g.rsiY(30) + 4}>30</text>
          <text className="chart__label" x={12} y={g.rsiTop + 10}>RSI 14</text>
          <path className="ind-rsi" d={g.rsi} />
        </>
      )}
    </svg>
  )
}
