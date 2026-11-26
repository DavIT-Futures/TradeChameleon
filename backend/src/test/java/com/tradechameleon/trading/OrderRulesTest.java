package com.tradechameleon.trading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tradechameleon.shared.DomainException;
import com.tradechameleon.shared.Side;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Pure rules of the matcher and of SL/TP validation, without Spring. */
class OrderRulesTest {

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    @Test
    void limitCrossing() {
        assertThat(OrderMatcher.limitCrossed(Side.BUY, d("99"), d("100"))).isTrue();
        assertThat(OrderMatcher.limitCrossed(Side.BUY, d("101"), d("100"))).isFalse();
        assertThat(OrderMatcher.limitCrossed(Side.SELL, d("101"), d("100"))).isTrue();
        assertThat(OrderMatcher.limitCrossed(Side.SELL, d("99"), d("100"))).isFalse();
    }

    @Test
    void stopTrigger() {
        assertThat(OrderMatcher.stopReached(Side.BUY, d("101"), d("100"))).isTrue();
        assertThat(OrderMatcher.stopReached(Side.BUY, d("99"), d("100"))).isFalse();
        assertThat(OrderMatcher.stopReached(Side.SELL, d("99"), d("100"))).isTrue();
        assertThat(OrderMatcher.stopReached(Side.SELL, d("101"), d("100"))).isFalse();
    }

    @Test
    void protectionMustSurroundTheEntry() {
        OrderService.validateProtection(Side.BUY, d("100"), d("95"), d("110"));
        OrderService.validateProtection(Side.BUY, d("100"), null, null);
        assertThatThrownBy(() -> OrderService.validateProtection(Side.BUY, d("100"), d("101"), null))
                .isInstanceOf(DomainException.class).hasMessageContaining("below");
        assertThatThrownBy(() -> OrderService.validateProtection(Side.BUY, d("100"), null, d("99")))
                .isInstanceOf(DomainException.class).hasMessageContaining("above");
        assertThatThrownBy(() -> OrderService.validateProtection(Side.SELL, d("100"), d("95"), null))
                .isInstanceOf(DomainException.class).hasMessageContaining("BUY");
    }
}
