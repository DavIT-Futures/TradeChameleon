package com.tradechameleon.watchlist;

import com.tradechameleon.identity.CurrentUser;
import com.tradechameleon.market.MarketData;
import com.tradechameleon.tenant.Tenant;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Personal watchlist: a set of symbols per user. PUT and DELETE are idempotent, so the star button in
 * the clients can simply toggle without reading first. Small enough to keep SQL in the controller's module.
 */
@RestController
@RequestMapping("/api/watchlist")
@Tag(name = "Watchlist", description = "Instruments the user follows")
@SecurityRequirement(name = "bearer")
class WatchlistController {

    private final JdbcClient jdbc;
    private final MarketData market;

    WatchlistController(JdbcClient jdbc, MarketData market) {
        this.jdbc = jdbc;
        this.market = market;
    }

    @GetMapping
    @Operation(summary = "Symbols on the caller's watchlist (only those the broker still offers)")
    List<String> list() {
        Tenant tenant = TenantContext.current();
        return jdbc.sql("select symbol from watchlist_item where tenant_id = ? and user_id = ? order by added_at, symbol")
                .params(tenant.id(), CurrentUser.get().userId())
                .query(String.class)
                .list()
                .stream()
                .filter(s -> market.find(s).filter(i -> tenant.allows(i.assetClass())).isPresent())
                .toList();
    }

    @PutMapping("/{symbol}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Add a symbol (idempotent)")
    void add(@PathVariable String symbol) {
        Tenant tenant = TenantContext.current();
        var instrument = market.require(symbol, tenant);
        jdbc.sql("insert into watchlist_item (tenant_id, user_id, symbol) values (?, ?, ?) on conflict do nothing")
                .params(tenant.id(), CurrentUser.get().userId(), instrument.symbol())
                .update();
    }

    @DeleteMapping("/{symbol}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove a symbol (idempotent)")
    void remove(@PathVariable String symbol) {
        jdbc.sql("delete from watchlist_item where tenant_id = ? and user_id = ? and symbol = ?")
                .params(TenantContext.current().id(), CurrentUser.get().userId(), symbol.toUpperCase())
                .update();
    }
}
