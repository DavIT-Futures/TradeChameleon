/**
 * Pure helpers for the broker editor in the admin panel. Identical copy in the React client.
 * The editor works on a TenantSettings draft: the editable part of a BrokerOverview.
 */
import type { AssetClass, BrokerOverview, Features, TenantSettings, Theme } from '../api/types';

export const COLOR_FIELDS: { key: keyof Theme; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'onPrimary', label: 'Text on primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Muted text' },
  { key: 'positive', label: 'Positive (gains)' },
  { key: 'negative', label: 'Negative (losses)' },
];

export const FEATURE_FIELDS: { key: keyof Features; label: string; hint: string }[] = [
  { key: 'trading', label: 'Trading', hint: 'Off = portfolio-only broker (read-only)' },
  { key: 'limitOrders', label: 'Pending orders', hint: 'Limit, stop and stop-limit orders' },
  { key: 'livePrices', label: 'Live prices', hint: 'Server-sent price stream' },
  { key: 'simulatorPanel', label: 'Developer panel', hint: 'Market simulator controls' },
  { key: 'screener', label: 'Screener', hint: '' },
  { key: 'news', label: 'News', hint: '' },
  { key: 'calendar', label: 'Economic calendar', hint: '' },
  { key: 'compare', label: 'Compare', hint: '' },
  { key: 'alerts', label: 'Price alerts', hint: '' },
  { key: 'riskView', label: 'Risk & margin view', hint: '' },
];

export const LOCALES = ['en-GB', 'en-US', 'de-DE', 'de-CH', 'fr-FR', 'pl-PL', 'ja-JP', 'es-ES', 'it-IT', 'nl-NL'];

/** The editable part of a broker, deep-copied so the draft never mutates the loaded data. */
export function toSettings(b: BrokerOverview): TenantSettings {
  return {
    name: b.name,
    tagline: b.tagline,
    locale: b.locale,
    currency: b.currency,
    allowedAssetClasses: [...b.allowedAssetClasses],
    spreadMarkupBps: b.spreadMarkupBps,
    logoShape: b.logoShape,
    theme: { ...b.theme },
    features: { ...b.features },
    limits: { ...b.limits },
  };
}

/** Toggles one asset class, keeping the canonical order of `all`. */
export function toggleClass(selected: readonly AssetClass[], c: AssetClass, all: readonly AssetClass[]): AssetClass[] {
  const set = new Set(selected);
  if (set.has(c)) set.delete(c);
  else set.add(c);
  return all.filter((x) => set.has(x));
}

/** "" (unlimited) or a number from a numeric input. */
export function parseLimit(value: string): number | null {
  const v = value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Radius as a number of pixels for a range input ("12px" -> 12). */
export function radiusPx(radius: string): number {
  const n = parseInt(radius, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Top-level fields that differ between the saved broker and the draft (for the "unsaved" badge). */
export function changedFields(saved: TenantSettings, draft: TenantSettings): string[] {
  return (Object.keys(draft) as (keyof TenantSettings)[]).filter(
    (k) => JSON.stringify(saved[k]) !== JSON.stringify(draft[k]),
  );
}

/** The validation message for one field ("theme.primary"), from a 400 problem's errors map. */
export function fieldError(errors: Record<string, string> | undefined, path: string): string | null {
  return errors?.[path] ?? null;
}
