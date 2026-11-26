import { candleGeometry } from './candleGeometry';
import { ema, rsi, sma } from './indicators';

describe('indicators', () => {
  it('sma averages the last n values', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('ema starts from the sma and reacts faster than it', () => {
    const values = [10, 10, 10, 10, 20];
    const e = ema(values, 3);
    expect(e.slice(0, 3)).toEqual([null, null, 10]);
    expect(e[4]!).toBeGreaterThan(sma(values, 3)[4]!);
  });

  it('rsi is 100 for a strictly rising series and 0 for a falling one', () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(up, 14)[19]).toBe(100);
    const down = up.slice().reverse();
    expect(rsi(down, 14)[19]).toBeCloseTo(0);
  });

  it('rsi stays within 0..100 on noisy data', () => {
    const noisy = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i) * 5 + (i % 3));
    for (const v of rsi(noisy).filter((x) => x !== null)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('candleGeometry', () => {
  const candles = Array.from({ length: 30 }, (_, i) => ({ t: i * 5000, open: 100 + i, high: 103 + i, low: 98 + i, close: 101 + i }));

  it('draws one body and one wick per candle and a separate RSI pane', () => {
    const g = candleGeometry(candles, 700, 300, { sma: true, ema: true, rsi: true });
    expect(g.bodies).toHaveLength(30);
    expect(g.wicks).toHaveLength(30);
    expect(g.bodies.every((b) => b.up)).toBe(true);
    expect(g.sma.startsWith('M')).toBe(true);
    expect(g.rsiTop).toBeGreaterThan(g.yTicks[0].y);
    expect(g.rsiBottom).toBeGreaterThan(g.rsiTop);
  });

  it('omits indicators that are switched off', () => {
    const g = candleGeometry(candles, 700, 300, { sma: false, ema: false, rsi: false });
    expect(g.sma).toBe('');
    expect(g.rsi).toBe('');
  });
});
