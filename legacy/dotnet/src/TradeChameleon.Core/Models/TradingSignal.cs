using System;

namespace TradeChameleon.Core.Models
{
    /// <summary>
    /// Directional market bias and execution recommendations.
    /// </summary>
    public enum SignalDirection
    {
        Flat = 0,
        Long,
        Short
    }

    /// <summary>
    /// Represents an actionable quantitative trading signal generated from market analysis.
    /// </summary>
    public sealed record TradingSignal(
        DateTimeOffset Timestamp,
        string Symbol,
        SignalDirection Direction,
        decimal Confidence,
        string Reason
    );
}
