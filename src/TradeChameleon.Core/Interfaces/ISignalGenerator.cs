using System.Collections.Generic;
using TradeChameleon.Core.Models;

namespace TradeChameleon.Core.Interfaces
{
    /// <summary>
    /// Contract for strategy components generating actionable trading signals from market data and regimes.
    /// </summary>
    public interface ISignalGenerator
    {
        /// <summary>
        /// Evaluates market history and the prevailing market regime to generate an actionable trading signal.
        /// </summary>
        /// <param name="history">Chronological sequence of price bars.</param>
        /// <param name="regime">Current identified market regime state.</param>
        /// <returns>Generated trading signal.</returns>
        TradingSignal GenerateSignal(IReadOnlyList<MarketDataPoint> history, MarketRegime regime);
    }
}
