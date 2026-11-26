/**
 * Friendly aliases over the types generated from the backend's OpenAPI document.
 * Regenerate schema.d.ts with `npm run gen:api` whenever the API changes; the compiler then
 * points at every place in the client that needs updating.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type Tenant = Schemas['TenantDto'];
export type Theme = Schemas['Theme'];
export type Features = Schemas['Features'];
export type AssetClass = Tenant['allowedAssetClasses'][number];
export type UserProfile = Schemas['UserProfile'];
export type TokenResponse = Schemas['TokenResponse'];
export type LoginRequest = Schemas['LoginRequest'];
export type InstrumentView = Schemas['InstrumentView'];
export type Quote = Schemas['Quote'];
export type PricePoint = Schemas['PricePointView'];
export type Portfolio = Schemas['PortfolioView'];
export type Position = Schemas['PositionView'];
export type Order = Schemas['Order'];
export type PlaceOrderRequest = Schemas['PlaceOrderRequest'];
export type SimulatorSettings = Schemas['SimulatorSettings'];

/** RFC 9457 Problem Details as returned by every error response of the API. */
export interface Problem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
  [extension: string]: unknown;
}
