import type { InstrumentView, Quote } from '../api/types';
import { contractFacts, matches, sortRows, spreadBps, spreadPips } from './marketBrowse';

const quote = (symbol: string, mid: number, changePct: number, spread = 0.02): Quote => ({
  symbol, bid: mid - spread / 2, ask: mid + spread / 2, mid, change: 0, changePct, timestamp: '2026-11-26T12:00:00Z',
});

const instrument = (over: Partial<InstrumentView>): InstrumentView => ({
  symbol: 'X', name: 'X', assetClass: 'STOCK', exchange: 'X', currency: 'USD', decimals: 2, category: 'Other',
  unit: 'share', contractSize: 1, pipSize: null, optionChain: false, description: '', quote: quote('X', 1, 0), ...over,
});

const fmt = (v: number, d = 2) => v.toFixed(d);

describe('market browsing', () => {
  it('computes spreads in bps and pips', () => {
    expect(spreadBps({ bid: 99.99, ask: 100.01, mid: 100 })).toBeCloseTo(2);
    expect(spreadPips({ bid: 1.0841, ask: 1.0843 }, 0.0001)).toBeCloseTo(2);
  });

  it('sorts by change in both directions and by symbol', () => {
    const rows = [
      { instrument: instrument({ symbol: 'B' }), quote: quote('B', 10, 1.5) },
      { instrument: instrument({ symbol: 'A' }), quote: quote('A', 10, -2) },
      { instrument: instrument({ symbol: 'C' }), quote: quote('C', 10, 0.3) },
    ];
    expect(sortRows(rows, 'change-desc').map((r) => r.instrument.symbol)).toEqual(['B', 'C', 'A']);
    expect(sortRows(rows, 'change-asc').map((r) => r.instrument.symbol)).toEqual(['A', 'C', 'B']);
    expect(sortRows(rows, 'symbol').map((r) => r.instrument.symbol)).toEqual(['A', 'B', 'C']);
  });

  it('searches symbol, name, category and description', () => {
    const gold = instrument({ symbol: 'XAUUSD', name: 'Gold', category: 'Metals', description: 'Spot gold' });
    expect(matches(gold, 'metal')).toBe(true);
    expect(matches(gold, 'xau')).toBe(true);
    expect(matches(gold, 'oil')).toBe(false);
  });

  it('describes a forex lot with pip value', () => {
    const eurusd = instrument({ symbol: 'EURUSD', assetClass: 'FX', contractSize: 100000, pipSize: 0.0001, decimals: 5 });
    const facts = contractFacts(eurusd, quote('EURUSD', 1.0842, 0, 0.0002), fmt);
    expect(facts.find((f) => f.label === 'Pip value (1 lot)')?.value).toBe('10.00 USD');
    expect(facts.find((f) => f.label === 'Spread')?.value).toBe('2.0 pips');
  });

  it('describes a commodity contract value', () => {
    const gold = instrument({ symbol: 'XAUUSD', assetClass: 'COMMODITY', contractSize: 100, unit: 'troy oz' });
    const facts = contractFacts(gold, quote('XAUUSD', 2650, 0), fmt);
    expect(facts.find((f) => f.label === 'Contract value')?.value).toBe('265000 USD');
  });
});
