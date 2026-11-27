/**
 * Builds the broker comparison matrix for the admin panel: one row per setting, one column per broker,
 * and a flag telling whether the brokers differ on that row. Pure function, identical copy in React.
 */
import type { AssetClass, BrokerOverview } from '../api/types';

export type Cell = boolean | string;

export interface MatrixRow {
  group: string;
  label: string;
  cells: Cell[];
  differs: boolean;
}

const CLASSES: AssetClass[] = ['STOCK', 'ETF', 'FX', 'CRYPTO', 'BOND', 'COMMODITY', 'INDEX', 'OPTION'];
const CLASS_NAMES: Record<AssetClass, string> = {
  STOCK: 'Stocks', ETF: 'ETFs', FX: 'Forex', CRYPTO: 'Crypto', BOND: 'Bonds', COMMODITY: 'Commodities', INDEX: 'Indices', OPTION: 'Options',
};

export function buildMatrix(brokers: readonly BrokerOverview[], fmt: (value: number, currency: string) => string): MatrixRow[] {
  const row = (group: string, label: string, cell: (b: BrokerOverview) => Cell): MatrixRow => {
    const cells = brokers.map(cell);
    return { group, label, cells, differs: new Set(cells.map(String)).size > 1 };
  };
  return [
    row('Brand', 'Locale', (b) => b.locale),
    row('Brand', 'Currency', (b) => b.currency),
    row('Brand', 'Colour scheme', (b) => b.theme.colorScheme),
    row('Brand', 'Corner radius', (b) => b.theme.radius),
    ...CLASSES.map((c) => row('Asset classes', CLASS_NAMES[c], (b) => b.allowedAssetClasses.includes(c))),
    row('Trading', 'Trading', (b) => b.features.trading),
    row('Trading', 'Pending orders (limit/stop)', (b) => b.features.limitOrders),
    row('Trading', 'Live prices', (b) => b.features.livePrices),
    row('Trading', 'Spread markup', (b) => `${b.spreadMarkupBps} bps`),
    row('Trading', 'Max order value', (b) => (b.limits.maxOrderValue == null ? 'unlimited' : fmt(b.limits.maxOrderValue, b.currency))),
    row('Trading', 'Max pending orders', (b) => (b.limits.maxOpenOrders == null ? 'unlimited' : String(b.limits.maxOpenOrders))),
    row('Tools', 'Screener', (b) => b.features.screener),
    row('Tools', 'News', (b) => b.features.news),
    row('Tools', 'Economic calendar', (b) => b.features.calendar),
    row('Tools', 'Compare', (b) => b.features.compare),
    row('Tools', 'Price alerts', (b) => b.features.alerts),
    row('Tools', 'Risk & margin view', (b) => b.features.riskView),
    row('Tools', 'Developer panel', (b) => b.features.simulatorPanel),
    row('Usage', 'Instruments offered', (b) => String(b.instruments)),
    row('Usage', 'Option chains', (b) => String(b.optionChains)),
    row('Usage', 'Users (traders / viewers / maintainers)', (b) => `${b.users} (${b.traders} / ${b.viewers} / ${b.maintainers})`),
    row('Usage', 'Open orders', (b) => String(b.openOrders)),
    row('Usage', 'Filled orders', (b) => String(b.filledOrders)),
    row('Usage', 'Client cash', (b) => fmt(b.totalCash, b.currency)),
  ];
}

/** Number of enabled optional features and asset classes: a quick "how rich is this product" score. */
export function featureScore(b: BrokerOverview): number {
  const f = b.features;
  return [f.trading, f.limitOrders, f.screener, f.news, f.calendar, f.compare, f.alerts, f.riskView, f.simulatorPanel]
    .filter(Boolean).length + b.allowedAssetClasses.length;
}
