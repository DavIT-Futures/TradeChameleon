package com.tradechameleon.shared;

/**
 * Asset classes a broker may enable for its clients. OPTION is special: options are not separate
 * instruments but chains derived from an optionable underlying (see the market module's OptionChains).
 */
public enum AssetClass {
    STOCK, ETF, FX, CRYPTO, BOND, COMMODITY, INDEX, OPTION
}
