package com.tradechameleon.tenant;

/** Optional product features a broker can switch on or off (see {@link Tenant.Features}). */
public enum Feature {
    SCREENER("the screener"),
    NEWS("market news"),
    CALENDAR("the economic calendar"),
    COMPARE("instrument comparison"),
    ALERTS("price alerts"),
    RISK_VIEW("the risk and margin view");

    private final String label;

    Feature(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
