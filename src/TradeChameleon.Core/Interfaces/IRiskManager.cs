using TradeChameleon.Core.Models;

namespace TradeChameleon.Core.Interfaces
{
    /// <summary>
    /// Contract for portfolio risk evaluation and position sizing policies prior to order execution.
    /// </summary>
    public interface IRiskManager
    {
        /// <summary>
        /// Determines whether a proposed trading signal satisfies active risk limits under the current market regime.
        /// </summary>
        /// <param name="signal">Candidate trading signal to evaluate.</param>
        /// <param name="regime">Current identified market regime state.</param>
        /// <param name="accountEquity">Current total portfolio equity in quote currency.</param>
        /// <returns><c>true</c> if the signal is approved for execution; otherwise, <c>false</c>.</returns>
        bool ApproveSignal(TradingSignal signal, MarketRegime regime, decimal accountEquity);

        /// <summary>
        /// Computes the maximum permitted position size for an approved trading signal.
        /// </summary>
        /// <param name="signal">Approved trading signal.</param>
        /// <param name="accountEquity">Current total portfolio equity in quote currency.</param>
        /// <param name="riskFractionPerTrade">Maximum fraction of equity risked on this trade (e.g., 0.01 for 1%).</param>
        /// <returns>Recommended non-negative position size in base units.</returns>
        decimal CalculatePositionSize(TradingSignal signal, decimal accountEquity, decimal riskFractionPerTrade);
    }
}
