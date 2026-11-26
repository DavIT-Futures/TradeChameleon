package com.tradechameleon.trading;

import com.tradechameleon.identity.CurrentUser;
import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Validated
@Tag(name = "Orders", description = "Market and limit orders")
@SecurityRequirement(name = "bearer")
class OrderController {

    private final OrderService service;

    OrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Place a market or limit order (role TRADER, tenant feature 'trading')")
    ResponseEntity<Order> place(@Valid @RequestBody PlaceOrderRequest request) {
        var order = service.place(TenantContext.current(), CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/orders/" + order.id())).body(order);
    }

    @GetMapping
    @Operation(summary = "Orders of the caller, newest first")
    List<Order> list(@RequestParam(required = false) Order.OrderStatus status,
                     @RequestParam(defaultValue = "50") @Min(1) @Max(500) int limit) {
        return service.list(TenantContext.current(), CurrentUser.get().userId(), status, limit);
    }

    @GetMapping("/{id}")
    @Operation(summary = "One order")
    Order get(@PathVariable UUID id) {
        return service.get(TenantContext.current(), CurrentUser.get().userId(), id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Cancel an open limit order")
    Order cancel(@PathVariable UUID id) {
        return service.cancel(TenantContext.current(), CurrentUser.get().userId(), id);
    }
}
