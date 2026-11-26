import type { InstrumentStats, Theme } from '../api/types';
import { NO_FILTERS, PRESETS, compareGeometry, rebase, runPreset, screen, themeFor } from './insights';

const stat = (symbol: string, over: Partial<InstrumentStats>): InstrumentStats => ({
  symbol, name: symbol, assetClass: 'STOCK', category: 'Tech', decimals: 2, mid: 100, changePct: 0, volatilityPct: 1,
  rsi14: 50, high: 110, low: 90, rangePct: 50, spreadBps: 5, longPct: 50, ...over,
});

const stats = [
  stat('UP', { changePct: 2.1, rsi14: 75, rangePct: 95 }),
  stat('DOWN', { changePct: -1.4, rsi14: 22, rangePct: 5, assetClass: 'FX' }),
  stat('FLAT', { changePct: 0.1, rsi14: null, volatilityPct: 9 }),
];

describe('screener', () => {
  it('filters by class and ranges, ignoring missing RSI for RSI filters', () => {
    expect(screen(stats, { ...NO_FILTERS, assetClass: 'FX' }).map((s) => s.symbol)).toEqual(['DOWN']);
    expect(screen(stats, { ...NO_FILTERS, minRsi: 70 }).map((s) => s.symbol)).toEqual(['UP']);
    expect(screen(stats, { ...NO_FILTERS, minChange: -2, maxChange: 1 }).map((s) => s.symbol)).toEqual(['DOWN', 'FLAT']);
  });

  it('runs the presets', () => {
    const run = (id: string) => runPreset(stats, PRESETS.find((p) => p.id === id)!).map((s) => s.symbol);
    expect(run('gainers')).toEqual(['UP']);
    expect(run('oversold')).toEqual(['DOWN']);
    expect(run('volatile')[0]).toBe('FLAT');
    expect(run('highs')).toEqual(['UP']);
  });
});

describe('comparison', () => {
  it('rebases a series to percent from the first point', () => {
    expect(rebase([{ t: 0, price: 50 }, { t: 1, price: 55 }]).map((p) => p.pct)).toEqual([0, 10]);
  });

  it('draws one line per series and a zero line inside the chart', () => {
    const g = compareGeometry([
      { symbol: 'A', points: [{ t: 0, price: 10 }, { t: 1, price: 11 }] },
      { symbol: 'B', points: [{ t: 0, price: 100 }, { t: 1, price: 95 }] },
    ], 400, 200);
    expect(g.lines.map((l) => l.symbol)).toEqual(['A', 'B']);
    expect(g.lines[0].last).toBeCloseTo(10);
    expect(g.lines[1].last).toBeCloseTo(-5);
    expect(g.zeroY).toBeGreaterThan(0);
    expect(g.zeroY).toBeLessThan(200);
  });
});

describe('colour scheme override', () => {
  const light = { colorScheme: 'light', primary: '#0f766e', background: '#fff', surface: '#fff', text: '#000', muted: '#666' } as Theme;

  it('keeps the brand theme by default and swaps only surfaces in dark mode', () => {
    expect(themeFor(light, 'brand')).toBe(light);
    const dark = themeFor(light, 'dark');
    expect(dark.colorScheme).toBe('dark');
    expect(dark.primary).toBe('#0f766e');
    expect(dark.background).not.toBe('#fff');
  });
});
