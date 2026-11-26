using System;

namespace TradeChameleon.Core.Models
{
    /// <summary>
    /// Represents upper and lower volatility boundaries calculated for adaptive regime modeling.
    /// </summary>
    public sealed record MarketVolatilityBand(
        DateTimeOffset Timestamp,
        string Symbol,
        decimal UpperBand,
        decimal MiddleBand,
        decimal LowerBand,
        decimal Bandwidth
    );
}
