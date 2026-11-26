package com.tradechameleon.insights;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.shared.DomainException;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public market insights: the economic calendar and the news wire (simulated, deterministic). */
@RestController
@RequestMapping("/api/market")
@Validated
@Tag(name = "Insights", description = "Economic calendar and market news")
class InsightsController {

    private final EconomicCalendar calendar;
    private final NewsWire news;

    InsightsController(EconomicCalendar calendar, NewsWire news) {
        this.calendar = calendar;
        this.news = news;
    }

    @GetMapping("/calendar")
    @Operation(summary = "Economic calendar (default: 2 days back to 5 days ahead)",
            description = "symbols lists only instruments the current broker offers.")
    List<EconomicEvent> calendar(@RequestParam(required = false) LocalDate from,
                                 @RequestParam(required = false) LocalDate to,
                                 @RequestParam(defaultValue = "1") @Min(1) @Max(3) int minImportance) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = from != null ? from : today.minusDays(2);
        LocalDate end = to != null ? to : today.plusDays(5);
        if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 31) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "validation", "Validation failed",
                    "The range must be 0 to 31 days long.", Map.of("errors", Map.of("to", "within 31 days of from")));
        }
        return calendar.events(TenantContext.current(), start, end, minImportance);
    }

    @GetMapping("/news")
    @Operation(summary = "Latest headlines of the last 24 hours, optionally for one symbol or asset class")
    List<NewsItem> news(@RequestParam(required = false) String symbol,
                        @RequestParam(required = false) AssetClass assetClass,
                        @RequestParam(defaultValue = "30") @Min(1) @Max(200) int limit) {
        return news.latest(TenantContext.current(), symbol, assetClass, limit);
    }
}
