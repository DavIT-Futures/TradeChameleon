package com.tradechameleon.portfolio;

import com.tradechameleon.identity.CurrentUser;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Portfolio", description = "Cash, positions and valuation")
@SecurityRequirement(name = "bearer")
class PortfolioController {

    private final Portfolios portfolios;

    PortfolioController(Portfolios portfolios) {
        this.portfolios = portfolios;
    }

    @GetMapping("/api/portfolio")
    @Operation(summary = "Portfolio of the caller, valued in the broker currency")
    PortfolioView portfolio() {
        return portfolios.view(TenantContext.current(), CurrentUser.get().userId());
    }
}
