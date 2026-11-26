import { Pipe, PipeTransform, inject } from '@angular/core';
import { TenantService } from './tenant';

/** Formatting with the broker's locale. Intl formatters are cached: creating them is not free. */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export function formatMoney(value: number, currency: string, locale: string): string {
  return formatter(locale, { style: 'currency', currency }).format(value);
}

export function formatPrice(value: number, decimals: number, locale: string): string {
  return formatter(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function formatPercent(value: number, locale: string): string {
  return formatter(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })
    .format(value / 100);
}

export function formatQuantity(value: number, locale: string): string {
  return formatter(locale, { maximumFractionDigits: 8 }).format(value);
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly tenant = inject(TenantService);
  transform(value: number | null | undefined, currency?: string): string {
    return value == null ? '–' : formatMoney(value, currency ?? this.tenant.currency(), this.tenant.locale());
  }
}

@Pipe({ name: 'price' })
export class PricePipe implements PipeTransform {
  private readonly tenant = inject(TenantService);
  transform(value: number | null | undefined, decimals = 2): string {
    return value == null ? '–' : formatPrice(value, decimals, this.tenant.locale());
  }
}

@Pipe({ name: 'pct' })
export class PercentPipe implements PipeTransform {
  private readonly tenant = inject(TenantService);
  transform(value: number | null | undefined): string {
    return value == null ? '–' : formatPercent(value, this.tenant.locale());
  }
}

@Pipe({ name: 'qty' })
export class QuantityPipe implements PipeTransform {
  private readonly tenant = inject(TenantService);
  transform(value: number | null | undefined): string {
    return value == null ? '–' : formatQuantity(value, this.tenant.locale());
  }
}
