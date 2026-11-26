using TradeChameleon.Core.Models;
using Xunit;

namespace TradeChameleon.Core.Tests;

public class TradingSignalTests
{
    [Fact]
    public void WithExpression_UpdatesConfidenceWhilePreservingSignalIdentity()
    {
        var timestamp = new DateTimeOffset(2026, 11, 25, 10, 0, 0, TimeSpan.Zero);
        var original = new TradingSignal(timestamp, "NQ", SignalDirection.Long, 0.75m, "Breakout");

        var adjusted = original with { Confidence = 0.90m };

        Assert.Equal(0.90m, adjusted.Confidence);
        Assert.Equal(original.Timestamp, adjusted.Timestamp);
        Assert.Equal(original.Symbol, adjusted.Symbol);
        Assert.Equal(original.Direction, adjusted.Direction);
        Assert.Equal(original.Reason, adjusted.Reason);
    }
}
