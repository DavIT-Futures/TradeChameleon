package com.tradechameleon.shared;

/** Direction of an order or a fill. */
public enum Side {
    BUY, SELL;

    /** +1 for BUY, -1 for SELL. Handy when updating positions and cash. */
    public int sign() {
        return this == BUY ? 1 : -1;
    }
}
