import { describe, expect, it } from 'vitest';
import type { AssetClass, BrokerOverview } from '../api/types';
import { changedFields, fieldError, parseLimit, radiusPx, toSettings, toggleClass } from './admin-settings';

const broker = {
  id: 'pulse', name: 'Pulse', tagline: 'Fast', locale: 'en-US', currency: 'USD', logoUrl: '/x.svg', logoShape: 'pulse',
  theme: {
    primary: '#a3e635', onPrimary: '#0a0a12', accent: '#f472b6', background: '#0a0a12', surface: '#151521', text: '#f4f4f8',
    muted: '#9a9ab0', positive: '#4ade80', negative: '#fb7185', radius: '16px', colorScheme: 'dark', fontBody: 'system-ui',
    fontHeading: 'system-ui',
  },
  allowedAssetClasses: ['STOCK', 'ETF', 'CRYPTO'], spreadMarkupBps: 35,
  features: {
    trading: true, limitOrders: false, simulatorPanel: false, livePrices: true, screener: false, news: true,
    calendar: false, compare: false, alerts: true, riskView: false,
  },
  limits: { maxOrderValue: 2000, maxOpenOrders: 0 },
  instruments: 14, optionChains: 0, users: 2, traders: 1, viewers: 1, openOrders: 0, filledOrders: 0, totalCash: 20000,
} as BrokerOverview;

const ALL: AssetClass[] = ['STOCK', 'ETF', 'FX', 'CRYPTO', 'BOND', 'COMMODITY', 'INDEX', 'OPTION'];

describe('admin settings editor helpers', () => {
  it('copies only the editable fields, deeply', () => {
    const s = toSettings(broker);
    expect(Object.keys(s)).not.toContain('users');
    s.theme.primary = '#000000';
    s.allowedAssetClasses.push('FX');
    expect(broker.theme.primary).toBe('#a3e635');
    expect(broker.allowedAssetClasses).toHaveLength(3);
  });

  it('toggles asset classes in canonical order', () => {
    expect(toggleClass(['CRYPTO', 'STOCK'], 'ETF', ALL)).toEqual(['STOCK', 'ETF', 'CRYPTO']);
    expect(toggleClass(['STOCK', 'ETF'], 'STOCK', ALL)).toEqual(['ETF']);
  });

  it('parses limits and radius', () => {
    expect(parseLimit('')).toBeNull();
    expect(parseLimit(' 2500 ')).toBe(2500);
    expect(radiusPx('16px')).toBe(16);
    expect(radiusPx('x')).toBe(0);
  });

  it('reports changed top-level fields and field errors', () => {
    const saved = toSettings(broker);
    const draft = toSettings(broker);
    expect(changedFields(saved, draft)).toEqual([]);
    draft.features.calendar = true;
    draft.name = 'Pulse Pro';
    expect(changedFields(saved, draft)).toEqual(['name', 'features']);
    expect(fieldError({ 'theme.primary': 'must be a colour like #1a2b3c' }, 'theme.primary')).toContain('#1a2b3c');
    expect(fieldError(undefined, 'name')).toBeNull();
  });
});
