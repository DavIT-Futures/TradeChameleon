package com.tradechameleon.market;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Public market data: instruments, quotes, price history and the live SSE stream. */
@RestController
@RequestMapping("/api/market")
@Validated
@Tag(name = "Market", description = "Instruments, quotes, history and live prices (SSE)")
class MarketController {

    private final MarketData market;
    private final PriceStream stream;
    private final MarketAnalytics analytics;

    MarketController(MarketData market, PriceStream stream, MarketAnalytics analytics) {
        this.market = market;
        this.stream = stream;
        this.analytics = analytics;
    }

    /** Instrument plus its current tenant-specific quote. */
    record InstrumentView(
            String symbol, String name, AssetClass assetClass, String exchange, String currency, int decimals,
            Quote quote) {
    }

    record PricePointView(Instant t, BigDecimal price) {
    }

    @GetMapping("/instruments")
    @Operation(summary = "Instruments the current broker offers, with live quotes")
    List<InstrumentView> instruments() {
        Tenant tenant = TenantContext.current();
        return market.instruments(tenant).stream().map(i -> view(i, tenant)).toList();
    }

    @GetMapping("/instruments/{symbol}")
    @Operation(summary = "One instrument with its quote")
    InstrumentView instrument(@PathVariable String symbol) {
        Tenant tenant = TenantContext.current();
        return view(market.require(symbol, tenant), tenant);
    }

    @GetMapping("/instruments/{symbol}/history")
    @Operation(summary = "Recent mid prices (one point per engine tick) for sparklines and charts")
    List<PricePointView> history(@PathVariable String symbol,
                                 @RequestParam(defaultValue = "120") @Min(2) @Max(1000) int points) {
        var instrument = market.require(symbol, TenantContext.current());
        return market.history(instrument.symbol(), points).stream()
                .map(p -> new PricePointView(p.at(), p.price()))
                .toList();
    }

    @GetMapping("/instruments/{symbol}/candles")
    @Operation(summary = "OHLC candles aggregated from engine ticks",
            description = "interval: 5s, 15s, 1m or 5m. The engine keeps the last 2 hours of ticks.")
    List<Candle> candles(@PathVariable String symbol,
                         @RequestParam(defaultValue = "15s") String interval,
                         @RequestParam(defaultValue = "120") @Min(1) @Max(500) int limit) {
        var instrument = market.require(symbol, TenantContext.current());
        var duration = MarketAnalytics.INTERVALS.get(interval);
        if (duration == null) {
            throw new com.tradechameleon.shared.DomainException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "validation", "Validation failed", "interval must be one of 5s, 15s, 1m, 5m.",
                    Map.of("errors", Map.of("interval", "one of 5s, 15s, 1m, 5m")));
        }
        return analytics.candles(instrument.symbol(), duration, limit);
    }

    @GetMapping("/instruments/{symbol}/depth")
    @Operation(summary = "Simulated market depth (order book) around the broker's bid/ask")
    OrderBook depth(@PathVariable String symbol, @RequestParam(defaultValue = "10") @Min(1) @Max(25) int levels) {
        Tenant tenant = TenantContext.current();
        return analytics.depth(market.require(symbol, tenant), tenant, levels);
    }

    @GetMapping("/sparklines")
    @Operation(summary = "Last N mid prices of every instrument of the broker, in one call (for the markets list)")
    Map<String, List<BigDecimal>> sparklines(@RequestParam(defaultValue = "60") @Min(2) @Max(240) int points) {
        var result = new LinkedHashMap<String, List<BigDecimal>>();
        for (Instrument i : market.instruments(TenantContext.current())) {
            result.put(i.symbol(), market.history(i.symbol(), points).stream().map(PriceEngine.PricePoint::price).toList());
        }
        return result;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Live quotes as Server-Sent Events",
            description = "Emits an event named 'quotes' with an array of Quote objects on every tick (1/s).",
            responses = @ApiResponse(responseCode = "200", content = @Content(
                    mediaType = MediaType.TEXT_EVENT_STREAM_VALUE,
                    schema = @Schema(type = "array", implementation = Quote.class))))
    SseEmitter stream() {
        return stream.subscribe(TenantContext.current());
    }

    private InstrumentView view(Instrument i, Tenant tenant) {
        return new InstrumentView(i.symbol(), i.name(), i.assetClass(), i.exchange(), i.currency(), i.decimals(),
                market.quote(i, tenant));
    }
}
