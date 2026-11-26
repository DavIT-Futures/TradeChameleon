/**
 * Pure helpers for the screener, the comparison chart and the colour-scheme override.
 * Identical copy in the React client; unit-tested.
 */
import type { InstrumentStats, Theme } from '../api/types';

// ---- screener -----------------------------------------------------------------------------------

export interface ScreenFilters {
  assetClass: string | null;
  minChange: number | null;
  maxChange: number | null;
  minRsi: number | null;
  maxRsi: number | null;
  minVolatility: number | null;
  maxSpreadBps: number | null;
}

export const NO_FILTERS: ScreenFilters = {
  assetClass: null, minChange: null, maxChange: null, minRsi: null, maxRsi: null, minVolatility: null, maxSpreadBps: null,
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  filters: Partial<ScreenFilters>;
  sort: (a: InstrumentStats, b: InstrumentStats) => number;
}

export const PRESETS: Preset[] = [
  { id: 'gainers', label: 'Top gainers', description: 'Up more than 0.5% today', filters: { minChange: 0.5 }, sort: (a, b) => b.changePct - a.changePct },
  { id: 'losers', label: 'Top losers', description: 'Down more than 0.5% today', filters: { maxChange: -0.5 }, sort: (a, b) => a.changePct - b.changePct },
  { id: 'oversold', label: 'Oversold (RSI < 30)', description: 'RSI(14) on 1-minute candles below 30', filters: { maxRsi: 30 }, sort: (a, b) => (a.rsi14 ?? 50) - (b.rsi14 ?? 50) },
  { id: 'overbought', label: 'Overbought (RSI > 70)', description: 'RSI(14) on 1-minute candles above 70', filters: { minRsi: 70 }, sort: (a, b) => (b.rsi14 ?? 50) - (a.rsi14 ?? 50) },
  { id: 'volatile', label: 'Most volatile', description: '1-hour realised volatility', filters: {}, sort: (a, b) => b.volatilityPct - a.volatilityPct },
  { id: 'highs', label: 'Near session high', description: 'Price in the top 10% of the 2-hour range', filters: {}, sort: (a, b) => b.rangePct - a.rangePct },
];

export function screen(stats: readonly InstrumentStats[], f: ScreenFilters): InstrumentStats[] {
  return stats.filter((s) =>
    (f.assetClass === null || s.assetClass === f.assetClass)
    && (f.minChange === null || s.changePct >= f.minChange)
    && (f.maxChange === null || s.changePct <= f.maxChange)
    && (f.minRsi === null || (s.rsi14 !== null && s.rsi14 >= f.minRsi))
    && (f.maxRsi === null || (s.rsi14 !== null && s.rsi14 <= f.maxRsi))
    && (f.minVolatility === null || s.volatilityPct >= f.minVolatility)
    && (f.maxSpreadBps === null || s.spreadBps <= f.maxSpreadBps));
}

/** Applies a preset: its filters plus its sort; "Near session high" additionally keeps rangePct ≥ 90. */
export function runPreset(stats: readonly InstrumentStats[], preset: Preset): InstrumentStats[] {
  const filtered = screen(stats, { ...NO_FILTERS, ...preset.filters });
  return (preset.id === 'highs' ? filtered.filter((s) => s.rangePct >= 90) : filtered).sort(preset.sort);
}

// ---- comparison chart ---------------------------------------------------------------------------

export interface Series {
  symbol: string;
  points: { t: number; price: number }[];
}

export const SERIES_COLORS = ['var(--tc-primary)', 'var(--tc-accent)', '#8b5cf6', '#ef4444'];

/** Rebases a price series to percent change from its first point (0% = start). */
export function rebase(points: readonly { t: number; price: number }[]): { t: number; pct: number }[] {
  if (points.length === 0) return [];
  const first = points[0].price;
  return points.map((p) => ({ t: p.t, pct: ((p.price - first) / first) * 100 }));
}

export function compareGeometry(series: readonly Series[], width: number, height: number, pad = { top: 12, right: 56, bottom: 22, left: 8 }) {
  const rebased = series.map((s) => ({ symbol: s.symbol, points: rebase(s.points) }));
  const all = rebased.flatMap((s) => s.points);
  if (all.length < 2) return { lines: [] as { symbol: string; d: string; last: number }[], yTicks: [] as { y: number; value: number }[], zeroY: 0 };
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  let min = Math.min(0, ...all.map((p) => p.pct));
  let max = Math.max(0, ...all.map((p) => p.pct));
  const margin = (max - min) * 0.1 || 0.1;
  min -= margin;
  max += margin;
  const x = (t: number) => pad.left + ((t - t0) / (t1 - t0 || 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * (height - pad.top - pad.bottom);
  const lines = rebased.map((s) => ({
    symbol: s.symbol,
    d: s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' '),
    last: s.points.length ? s.points[s.points.length - 1].pct : 0,
  }));
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = min + ((max - min) * i) / 4;
    return { y: y(value), value };
  });
  return { lines, yTicks, zeroY: y(0) };
}

// ---- colour scheme override ---------------------------------------------------------------------

export type SchemePreference = 'brand' | 'light' | 'dark';

/**
 * The broker decides its theme, but the user may force light or dark. Brand colours (primary, accent,
 * positive, negative) stay; only the surfaces and text are swapped.
 */
export function themeFor(brand: Theme, preference: SchemePreference): Theme {
  if (preference === 'brand' || preference === brand.colorScheme) return brand;
  return preference === 'dark'
    ? { ...brand, colorScheme: 'dark', background: '#0f1115', surface: '#171a21', text: '#e7e9ee', muted: '#9aa1ad' }
    : { ...brand, colorScheme: 'light', background: '#f5f6f8', surface: '#ffffff', text: '#161a22', muted: '#5f6676' };
}
