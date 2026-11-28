package com.tradechameleon.shared;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class FxRatesTest {

    @Test
    void sameCurrencyIsIdentity() {
        assertThat(FxRates.convert(new BigDecimal("123.45"), "PLN", "PLN")).isEqualByComparingTo("123.45");
    }

    @Test
    void convertsThroughUsd() {
        // 100 EUR = 108.42 USD = 108.42 / 1.2715 GBP
        assertThat(FxRates.convert(new BigDecimal("100"), "EUR", "GBP")).isEqualByComparingTo("85.2694");
    }

    @Test
    void rejectsUnknownCurrency() {
        assertThatThrownBy(() -> FxRates.convert(BigDecimal.ONE, "XXX", "USD"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void supportedCurrenciesAreSortedAndRejectUnknownTarget() {
        assertThat(FxRates.supported()).containsExactly("CHF", "EUR", "GBP", "JPY", "PLN", "USD");
        assertThatThrownBy(() -> FxRates.convert(BigDecimal.ONE, "USD", "XXX"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
