package com.tradechameleon.identity;

import com.tradechameleon.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Auth")
class MeController {

    @GetMapping("/api/me")
    @SecurityRequirement(name = "bearer")
    @Operation(summary = "Profile of the caller, taken from the validated JWT")
    UserProfile me() {
        var user = CurrentUser.get();
        return new UserProfile(user.userId(), user.name(), user.email(), user.roles(), TenantContext.current().id());
    }
}
