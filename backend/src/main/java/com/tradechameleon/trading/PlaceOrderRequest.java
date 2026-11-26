package com.tradechameleon.trading;

import com.tradechameleon.shared.Side;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** Body of {@code POST /api/orders}. {@code limitPrice} is required for LIMIT and ignored for MARKET. */
public record PlaceOrderRequest(
        @NotBlank String symbol,
        @NotNull Side side,
        @NotNull Order.OrderType type,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 8) BigDecimal quantity,
        @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal limitPrice) {
}
