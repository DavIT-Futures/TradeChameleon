/**
 * Market browsing helpers: labels, sorting, filtering and per-class contract facts.
 * Pure functions (identical copy in the React client), unit-tested.
 */
import type { AssetClass, InstrumentView, Quote } from '../api/types';

export const CLASS_LABELS: Record<AssetClass, string> = {
  STOCK: 'Stocks',
  ETF: 'ETFs',
  FX: 'Forex',
  CRYPTO: 'Crypto',
  BOND: 'Bonds',
  COMMODITY: 'Commodities',
  INDEX: 'Indices',
  OPTION: 'Options',
};

export type SortKey = 'symbol' | 'name' | 'change-desc' | 'change-asc' | 'spread';

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'symbol', label: 'Symbol A–Z' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'change-desc', label: 'Top gainers' },
  { key: 'change-asc', label: 'Top losers' },
  { key: 'spread', label: 'Tightest spread' },
];

/** Spread relative to the mid price, in basis points. */
export function spreadBps(q: Pick<Quote, 'bid' | 'ask' | 'mid'>): number {
  return ((q.ask - q.bid) / q.mid) * 10_000;
}

/** FX spread in pips (ask − bid) / pip size. */
export function spreadPips(q: Pick<Quote, 'bid' | 'ask'>, pipSize: number): number {
  return (q.ask - q.bid) / pipSize;
}

export interface Row {
  instrument: InstrumentView;
  quote: Quote;
}

export function sortRows<T extends Row>(rows: readonly T[], key: SortKey): T[] {
  const copy = [...rows];
  const by: Record<SortKey, (a: T, b: T) => number> = {
    symbol: (a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol),
    name: (a, b) => a.instrument.name.localeCompare(b.instrument.name),
    'change-desc': (a, b) => b.quote.changePct - a.quote.changePct,
    'change-asc': (a, b) => a.quote.changePct - b.quote.changePct,
    spread: (a, b) => spreadBps(a.quote) - spreadBps(b.quote),
  };
  return copy.sort(by[key]);
}

/** Text search over symbol, name, category and description. */
export function matches(i: InstrumentView, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || [i.symbol, i.name, i.category, i.description].some((s) => s.toLowerCase().includes(q));
}

export interface Fact {
  label: string;
  value: string;
}

/**
 * Contract facts that matter for each asset class, e.g. pip value for forex or the value of one
 * contract for commodities. `fmt(value, decimals)` formats numbers in the broker's locale.
 */
export function contractFacts(i: InstrumentView, q: Quote, fmt: (v: number, decimals?: number) => string): Fact[] {
  const size = i.contractSize;
  const ccy = i.currency;
  switch (i.assetClass) {
    case 'FX': {
      const pip = i.pipSize ?? 0.0001;
      return [
        { label: 'Base / quote', value: `${i.symbol.slice(0, 3)} / ${i.symbol.slice(3, 6)}` },
        { label: 'Pip size', value: String(pip) },
        { label: 'Spread', value: `${fmt(spreadPips(q, pip), 1)} pips` },
        { label: 'Lot size', value: `${fmt(size, 0)} ${i.symbol.slice(0, 3)}` },
        { label: 'Pip value (1 lot)', value: `${fmt(size * pip, 2)} ${ccy}` },
        { label: 'Lot notional', value: `${fmt(size * q.mid, 0)} ${ccy}` },
      ];
    }
    case 'COMMODITY':
      return [
        { label: 'Group', value: i.category },
        { label: 'Quoted per', value: `1 ${i.unit}` },
        { label: 'Contract size', value: `${fmt(size, 0)} ${i.unit}` },
        { label: 'Contract value', value: `${fmt(size * q.mid, 0)} ${ccy}` },
        { label: 'Value of a 1% move', value: `${fmt(size * q.mid * 0.01, 2)} ${ccy}` },
        { label: 'Spread', value: `${fmt(spreadBps(q), 1)} bps` },
      ];
    case 'INDEX':
      return [
        { label: 'Region', value: i.category },
        { label: 'Value per point', value: `${fmt(size, 0)} ${ccy}` },
        { label: 'Contract value', value: `${fmt(size * q.mid, 0)} ${ccy}` },
        { label: 'Spread', value: `${fmt(q.ask - q.bid, i.decimals)} pts` },
      ];
    case 'CRYPTO':
      return [
        { label: 'Category', value: i.category },
        { label: 'Quoted per', value: `1 ${i.unit}` },
        { label: 'Spread', value: `${fmt(spreadBps(q), 1)} bps` },
        { label: 'Trading hours', value: '24/7' },
      ];
    case 'BOND':
      return [
        { label: 'Issuer', value: i.category },
        { label: 'Quoted as', value: '% of nominal' },
        { label: 'Spread', value: `${fmt(spreadBps(q), 1)} bps` },
      ];
    default:
      return [
        { label: i.assetClass === 'ETF' ? 'Type' : 'Sector', value: i.category },
        { label: 'Exchange', value: i.exchange },
        { label: 'Quoted per', value: `1 ${i.unit}` },
        { label: 'Spread', value: `${fmt(spreadBps(q), 1)} bps` },
      ];
  }
}
