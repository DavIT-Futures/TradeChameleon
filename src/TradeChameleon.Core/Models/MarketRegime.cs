namespace TradeChameleon.Core.Models
{
    /// <summary>
    /// Represents identified market conditions and dynamic trading regimes.
    /// </summary>
    public enum MarketRegime
    {
        Unknown = 0,
        BullishTrending,
        BearishTrending,
        HighVolatilityExpansion,
        LowVolatilityCompression,
        MeanRevertingRange
    }
}