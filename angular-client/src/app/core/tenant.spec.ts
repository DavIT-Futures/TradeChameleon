import { applyTheme, resolveTenantFromLocation } from './tenant';
import type { Tenant } from '../api/types';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('resolveTenantFromLocation', () => {
  it('uses the *.localhost subdomain first', () => {
    expect(resolveTenantFromLocation({ hostname: 'kestrel.localhost', search: '?tenant=wisla' })).toBe('kestrel');
  });

  it('falls back to ?tenant= and remembers it', () => {
    const storage = memoryStorage();
    expect(resolveTenantFromLocation({ hostname: 'localhost', search: '?tenant=wisla' }, storage)).toBe('wisla');
    expect(resolveTenantFromLocation({ hostname: 'localhost', search: '' }, storage)).toBe('wisla');
  });

  it('returns null so that the backend picks its default', () => {
    expect(resolveTenantFromLocation({ hostname: 'localhost', search: '' }, memoryStorage())).toBeNull();
  });
});

describe('applyTheme', () => {
  it('writes the brand into CSS custom properties', () => {
    const root = document.createElement('div');
    const tenant = {
      id: 'sakura', locale: 'ja-JP',
      theme: { primary: '#db2777', onPrimary: '#fff', accent: '#7c3aed', background: '#fff7fa', surface: '#fff', text: '#2a1720',
        muted: '#7a6070', positive: '#15803d', negative: '#be123c', radius: '20px', colorScheme: 'light', fontBody: 'serif', fontHeading: 'serif' },
    } as Tenant;
    applyTheme(tenant, root);
    expect(root.style.getPropertyValue('--tc-primary')).toBe('#db2777');
    expect(root.style.getPropertyValue('--tc-radius')).toBe('20px');
    expect(root.dataset['tenant']).toBe('sakura');
  });
});
