using System;

namespace TradeChameleon.Core.Models
{
    /// <summary>
    /// Represents an immutable OHLCV market price bar with high-precision timestamp.
    /// </summary>
    public sealed record MarketDataPoint(
        DateTimeOffset Timestamp,
        string Symbol,
        decimal Open,
        decimal High,
        decimal Low,
        decimal Close,
        decimal Volume
    );
}