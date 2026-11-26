using TradeChameleon.Core.Models;
using Xunit;

namespace TradeChameleon.Core.Tests;

public class MarketDataPointTests
{
    [Fact]
    public void ValueEquality_IdenticalOhlcvBars_AreEqualAndShareHashCode()
    {
        var timestamp = new DateTimeOffset(2026, 11, 26, 15, 30, 0, TimeSpan.Zero);
        var first = new MarketDataPoint(timestamp, "ES", 5900.25m, 5910.50m, 5895.00m, 5908.75m, 12500m);
        var second = new MarketDataPoint(timestamp, "ES", 5900.25m, 5910.50m, 5895.00m, 5908.75m, 12500m);

        Assert.Equal(first, second);
        Assert.Equal(first.GetHashCode(), second.GetHashCode());
        Assert.NotEqual(first, first with { Close = 5909.00m });
    }
}
