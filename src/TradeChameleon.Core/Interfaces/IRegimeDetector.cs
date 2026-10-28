using System.Collections.Generic;
using TradeChameleon.Core.Models;

namespace TradeChameleon.Core.Interfaces
{
    /// <summary>
    /// Contract for statistical and machine-learning market regime detectors.
    /// </summary>
    public interface IRegimeDetector
    {
        /// <summary>
        /// Analyzes historical market bars to identify the prevailing regime.
        /// </summary>
        /// <param name="history">Chronological sequence of price bars.</param>
        /// <returns>Identified market regime state.</returns>
        MarketRegime DetectCurrentRegime(IReadOnlyList<MarketDataPoint> history);
    }
}