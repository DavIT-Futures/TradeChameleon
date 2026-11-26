package com.tradechameleon.portfolio;

import com.tradechameleon.identity.CurrentUser;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/portfolio")
@Validated
@Tag(name = "Portfolio", description = "Cash, positions, protection, account statement and realised P&L")
@SecurityRequirement(name = "bearer")
class PortfolioController {

    private final Portfolios portfolios;

    PortfolioController(Portfolios portfolios) {
        this.portfolios = portfolios;
    }

    record AmountRequest(@NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("100000000") BigDecimal amount) {
    }

    /** Both fields optional: null removes that protection. */
    record ProtectionRequest(
            @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal stopLoss,
            @Schema(nullable = true) @DecimalMin(value = "0", inclusive = false) BigDecimal takeProfit) {
    }

    @GetMapping
    @Operation(summary = "Portfolio of the caller, valued in the broker currency")
    PortfolioView portfolio() {
        return portfolios.view(TenantContext.current(), CurrentUser.get().userId());
    }

    @GetMapping("/risk")
    @Operation(summary = "Exposure, CFD margin requirement, margin level and concentration warnings")
    PortfolioRisk risk() {
        return portfolios.risk(TenantContext.current(), CurrentUser.get().userId());
    }

    @PutMapping("/positions/{symbol}/protection")
    @Operation(summary = "Set or remove stop-loss / take-profit on an open position (role TRADER)")
    PortfolioView protect(@PathVariable String symbol, @Valid @RequestBody ProtectionRequest request) {
        return portfolios.protect(TenantContext.current(), CurrentUser.get().userId(), symbol, request.stopLoss(),
                request.takeProfit());
    }

    @GetMapping("/transactions")
    @Operation(summary = "Account statement: deposits, withdrawals and trade cash flows, newest first")
    List<CashTransaction> transactions(@RequestParam(defaultValue = "50") @Min(1) @Max(500) int limit) {
        return portfolios.transactions(TenantContext.current(), CurrentUser.get().userId(), limit);
    }

    @GetMapping("/closed-trades")
    @Operation(summary = "Closed trades with realised P&L, newest first")
    List<ClosedTrade> closedTrades(@RequestParam(defaultValue = "50") @Min(1) @Max(500) int limit) {
        return portfolios.closedTrades(TenantContext.current(), CurrentUser.get().userId(), limit);
    }

    @PostMapping("/deposits")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Deposit demo cash (role TRADER)")
    CashTransaction deposit(@Valid @RequestBody AmountRequest request) {
        return portfolios.deposit(TenantContext.current(), CurrentUser.get().userId(), request.amount());
    }

    @PostMapping("/withdrawals")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Withdraw cash (role TRADER)")
    CashTransaction withdraw(@Valid @RequestBody AmountRequest request) {
        return portfolios.withdraw(TenantContext.current(), CurrentUser.get().userId(), request.amount());
    }
}
