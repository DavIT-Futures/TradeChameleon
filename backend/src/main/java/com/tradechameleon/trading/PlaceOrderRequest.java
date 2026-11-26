package com.tradechameleon.trading;

import com.tradechameleon.shared.Side;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * Body of {@code POST /api/orders}.
 * <ul>
 *   <li>MARKET: quantity only</li>
 *   <li>LIMIT: + limitPrice</li>
 *   <li>STOP: + stopPrice (becomes a market order when the stop is reached)</li>
 *   <li>STOP_LIMIT: + stopPrice and limitPrice (becomes a limit order when the stop is reached)</li>
 * </ul>
 * stopLoss / takeProfit (BUY only) are attached to the position when the order fills.
 */
public record PlaceOrderRequest(
        @NotBlank String symbol,
        @NotNull Side side,
        @NotNull Order.OrderType type,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 8) BigDecimal quantity,
        @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal limitPrice,
        @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal stopPrice,
        @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal stopLoss,
        @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal takeProfit) {
}
