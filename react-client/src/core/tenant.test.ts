import type { Tenant } from '../api/types'
import { applyTheme, resolveTenantFromLocation } from './tenant'

describe('resolveTenantFromLocation', () => {
  it('uses the *.localhost subdomain first', () => {
    expect(resolveTenantFromLocation({ hostname: 'sakura.localhost', search: '?tenant=wisla' })).toBe('sakura')
  })

  it('falls back to ?tenant= and remembers it', () => {
    localStorage.clear()
    expect(resolveTenantFromLocation({ hostname: 'localhost', search: '?tenant=kestrel' }, localStorage)).toBe('kestrel')
    expect(resolveTenantFromLocation({ hostname: 'localhost', search: '' }, localStorage)).toBe('kestrel')
  })
})

describe('applyTheme', () => {
  it('writes CSS custom properties and the color scheme', () => {
    const root = document.createElement('div')
    applyTheme({
      id: 'kestrel', locale: 'de-DE',
      theme: { primary: '#818cf8', onPrimary: '#0b1020', accent: '#22d3ee', background: '#0b1020', surface: '#141b2d', text: '#e6e9f2',
        muted: '#8b93a7', positive: '#34d399', negative: '#f87171', radius: '4px', colorScheme: 'dark', fontBody: 'sans-serif', fontHeading: 'monospace' },
    } as Tenant, root)
    expect(root.style.getPropertyValue('--tc-bg')).toBe('#0b1020')
    expect(root.style.colorScheme).toBe('dark')
    expect(root.lang).toBe('de-DE')
  })
})
