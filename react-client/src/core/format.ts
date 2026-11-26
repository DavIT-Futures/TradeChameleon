import { useMemo } from 'react'
import { useTenant } from './TenantProvider'

const cache = new Map<string, Intl.NumberFormat>()

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options)
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, options)
    cache.set(key, f)
  }
  return f
}

export const formatMoney = (v: number, currency: string, locale: string) =>
  formatter(locale, { style: 'currency', currency }).format(v)
export const formatPrice = (v: number, decimals: number, locale: string) =>
  formatter(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)
export const formatPercent = (v: number, locale: string) =>
  formatter(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(v / 100)
export const formatQuantity = (v: number, locale: string) => formatter(locale, { maximumFractionDigits: 8 }).format(v)

/** Formatting bound to the current broker's locale and currency. */
export function useFormat() {
  const { tenant } = useTenant()
  return useMemo(() => {
    const { locale, currency } = tenant
    const dash = '–'
    return {
      money: (v: number | null | undefined, ccy = currency) => (v == null ? dash : formatMoney(v, ccy, locale)),
      price: (v: number | null | undefined, decimals = 2) => (v == null ? dash : formatPrice(v, decimals, locale)),
      pct: (v: number | null | undefined) => (v == null ? dash : formatPercent(v, locale)),
      qty: (v: number | null | undefined) => (v == null ? dash : formatQuantity(v, locale)),
    }
  }, [tenant])
}
