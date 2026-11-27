import type { BrokerOverview } from '../api/types';
import { buildMatrix, featureScore } from './admin-matrix';

const broker = (id: string, over: Partial<BrokerOverview> = {}): BrokerOverview => ({
  id, name: id, tagline: '', locale: 'en-GB', currency: 'GBP', logoUrl: '',
  theme: { colorScheme: 'light', radius: '8px' } as BrokerOverview['theme'],
  allowedAssetClasses: ['STOCK'], spreadMarkupBps: 5,
  features: { trading: true, limitOrders: true, simulatorPanel: true, livePrices: true, screener: true, news: true, calendar: true, compare: true, alerts: true, riskView: true },
  limits: { maxOrderValue: null, maxOpenOrders: null },
  instruments: 10, optionChains: 0, users: 2, traders: 1, viewers: 1, openOrders: 0, filledOrders: 0, totalCash: 1000,
  ...over,
});

const fmt = (v: number, c: string) => `${v} ${c}`;

describe('admin matrix', () => {
  const a = broker('a');
  const b = broker('b', {
    allowedAssetClasses: ['STOCK', 'CRYPTO'],
    features: { ...a.features, screener: false },
    limits: { maxOrderValue: 2000, maxOpenOrders: 0 },
  });
  const rows = buildMatrix([a, b], fmt);
  const find = (label: string) => rows.find((r) => r.label === label)!;

  it('has one cell per broker and marks rows that differ', () => {
    expect(find('Screener').cells).toEqual([true, false]);
    expect(find('Screener').differs).toBe(true);
    expect(find('News').differs).toBe(false);
    expect(find('Crypto').cells).toEqual([false, true]);
  });

  it('formats limits', () => {
    expect(find('Max order value').cells).toEqual(['unlimited', '2000 GBP']);
    expect(find('Max pending orders').cells).toEqual(['unlimited', '0']);
  });

  it('scores richer products higher', () => {
    expect(featureScore(b)).toBe(featureScore(a)); // one feature less, one asset class more
    expect(featureScore(broker('c', { features: { ...a.features, alerts: false, news: false } }))).toBeLessThan(featureScore(a));
  });
});
