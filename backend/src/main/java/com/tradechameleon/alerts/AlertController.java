package com.tradechameleon.alerts;

import com.tradechameleon.identity.CurrentUser;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/alerts")
@Tag(name = "Alerts", description = "Price alerts and in-app notifications")
@SecurityRequirement(name = "bearer")
class AlertController {

    private final AlertService service;

    AlertController(AlertService service) {
        this.service = service;
    }

    record CreateAlertRequest(
            @NotBlank String symbol,
            @NotNull PriceAlert.Condition condition,
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal price,
            @Schema(nullable = true) @Size(max = 120) String note) {
    }

    @GetMapping
    @Operation(summary = "Alerts of the caller, newest first")
    List<PriceAlert> list(@RequestParam(required = false) PriceAlert.Status status) {
        return service.list(TenantContext.current(), CurrentUser.get().userId(), status);
    }

    @PostMapping
    @Operation(summary = "Create a price alert (ABOVE / BELOW the mid price)")
    ResponseEntity<PriceAlert> create(@Valid @RequestBody CreateAlertRequest r) {
        var alert = service.create(TenantContext.current(), CurrentUser.get().userId(), r.symbol(), r.condition(),
                r.price(), r.note());
        return ResponseEntity.created(URI.create("/api/alerts/" + alert.id())).body(alert);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Cancel an active alert")
    PriceAlert cancel(@PathVariable UUID id) {
        return service.cancel(TenantContext.current(), CurrentUser.get().userId(), id);
    }

    @GetMapping("/notifications")
    @Operation(summary = "Triggered alerts the client has not shown yet (polled by the clients)")
    List<PriceAlert> notifications() {
        return service.notifications(TenantContext.current(), CurrentUser.get().userId());
    }

    @PostMapping("/{id}/ack")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Mark a triggered alert as shown")
    void acknowledge(@PathVariable UUID id) {
        service.acknowledge(TenantContext.current(), CurrentUser.get().userId(), id);
    }
}
