package com.tradechameleon.tenant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tradechameleon.shared.AssetClass;
import com.tradechameleon.shared.DomainException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class TenantResolverTest {

    private final TenantResolver resolver = new TenantResolver(directory());

    private static TenantDirectory directory() {
        TenantRepository repo = mock(TenantRepository.class);
        when(repo.findAll()).thenReturn(List.of(tenant("aurora"), tenant("kestrel"), tenant("sakura")));
        return new TenantDirectory(repo, new TenantProperties("aurora"), event -> { });
    }

    private static Tenant tenant(String id) {
        var theme = new Tenant.Theme("#000", "#fff", "#111", "#fff", "#fff", "#000", "#666", "#0a0", "#a00",
                "4px", "light", "sans-serif", "serif");
        return new Tenant(id, id, "", "en-GB", "GBP", Set.of(AssetClass.STOCK), 0, id, theme,
                new Tenant.Features(true, true, true, true, true, true, true, true, true, true), new Tenant.Limits(null, null));
    }

    private static MockHttpServletRequest request(String host) {
        var r = new MockHttpServletRequest("GET", "/api/tenants/current");
        r.setServerName(host);
        return r;
    }

    @Test
    void subdomainWins() {
        var r = request("kestrel.localhost");
        r.setParameter("tenant", "sakura");
        assertThat(resolver.resolve(r).id()).isEqualTo("kestrel");
    }

    @Test
    void nestedSubdomainUsesTheLabelNextToLocalhost() {
        assertThat(resolver.resolve(request("api.sakura.localhost")).id()).isEqualTo("sakura");
    }

    @Test
    void queryParameterBeatsHeader() {
        var r = request("localhost");
        r.setParameter("tenant", "sakura");
        r.addHeader(TenantResolver.HEADER, "kestrel");
        assertThat(resolver.resolve(r).id()).isEqualTo("sakura");
    }

    @Test
    void headerIsUsedBySpas() {
        var r = request("localhost");
        r.addHeader(TenantResolver.HEADER, "KESTREL");
        assertThat(resolver.resolve(r).id()).isEqualTo("kestrel");
    }

    @Test
    void fallsBackToDefault() {
        assertThat(resolver.resolve(request("localhost")).id()).isEqualTo("aurora");
        assertThat(resolver.resolve(request("unknown.localhost")).id()).isEqualTo("aurora");
    }

    @Test
    void explicitUnknownTenantIsRejected() {
        var r = request("localhost");
        r.setParameter("tenant", "nope");
        assertThatThrownBy(() -> resolver.resolve(r)).isInstanceOf(DomainException.class)
                .hasMessageContaining("nope");
    }
}
