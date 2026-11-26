/**
 * Turns OHLC candles (+ optional indicators) into SVG geometry for a two-pane chart:
 * price pane on top, RSI pane below. Pure function; identical copy in the React client.
 */
import { ema, rsi, sma } from './indicators';

export interface OhlcCandle {
  t: number; // epoch millis
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface IndicatorFlags {
  sma: boolean;
  ema: boolean;
  rsi: boolean;
}

export interface CandleGeometry {
  bodies: { x: number; y: number; w: number; h: number; up: boolean }[];
  wicks: { x: number; y1: number; y2: number; up: boolean }[];
  sma: string;
  ema: string;
  rsi: string;
  yTicks: { y: number; value: number }[];
  xTicks: { x: number; label: string }[];
  rsiTop: number;
  rsiBottom: number;
  rsiY: (v: number) => number;
  last: { y: number; value: number } | null;
}

export const SMA_PERIOD = 20;
export const EMA_PERIOD = 9;
export const RSI_PERIOD = 14;

function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = '';
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d === '' ? 'M' : ' L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return d;
}

export function candleGeometry(
  candles: readonly OhlcCandle[],
  width: number,
  height: number,
  flags: IndicatorFlags,
  pad = { top: 10, right: 64, bottom: 22, left: 8 },
): CandleGeometry {
  const rsiHeight = flags.rsi ? Math.round(height * 0.24) : 0;
  const priceBottom = height - pad.bottom - (flags.rsi ? rsiHeight + 12 : 0);
  const empty: CandleGeometry = {
    bodies: [], wicks: [], sma: '', ema: '', rsi: '', yTicks: [], xTicks: [],
    rsiTop: 0, rsiBottom: 0, rsiY: () => 0, last: null,
  };
  if (candles.length === 0) return empty;

  const closes = candles.map((c) => c.close);
  const smaValues = flags.sma ? sma(closes, SMA_PERIOD) : [];
  const emaValues = flags.ema ? ema(closes, EMA_PERIOD) : [];
  let min = Math.min(...candles.map((c) => c.low));
  let max = Math.max(...candles.map((c) => c.high));
  const margin = (max - min) * 0.08 || max * 0.001 || 1;
  min -= margin;
  max += margin;

  const innerW = width - pad.left - pad.right;
  const slot = innerW / candles.length;
  const bodyW = Math.max(1, slot * 0.65);
  const x = (i: number) => pad.left + slot * i + slot / 2;
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * (priceBottom - pad.top);

  const bodies = candles.map((c, i) => {
    const top = y(Math.max(c.open, c.close));
    const bottom = y(Math.min(c.open, c.close));
    return { x: x(i) - bodyW / 2, y: top, w: bodyW, h: Math.max(1, bottom - top), up: c.close >= c.open };
  });
  const wicks = candles.map((c, i) => ({ x: x(i), y1: y(c.high), y2: y(c.low), up: c.close >= c.open }));

  const rsiTop = priceBottom + 12;
  const rsiBottom = rsiTop + rsiHeight;
  const rsiY = (v: number) => rsiTop + (1 - v / 100) * rsiHeight;

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = min + ((max - min) * i) / 4;
    return { y: y(value), value };
  });
  const step = Math.max(1, Math.floor(candles.length / 4));
  const xTicks = candles
    .map((c, i) => ({ i, c }))
    .filter(({ i }) => i % step === 0)
    .map(({ i, c }) => ({ x: x(i), label: new Date(c.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }));

  const lastClose = closes[closes.length - 1];
  return {
    bodies,
    wicks,
    sma: path(smaValues, x, y),
    ema: path(emaValues, x, y),
    rsi: flags.rsi ? path(rsi(closes, RSI_PERIOD), x, rsiY) : '',
    yTicks,
    xTicks,
    rsiTop,
    rsiBottom,
    rsiY,
    last: { y: y(lastClose), value: lastClose },
  };
}
