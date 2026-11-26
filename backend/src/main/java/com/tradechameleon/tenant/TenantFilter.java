package com.tradechameleon.tenant;

import com.tradechameleon.shared.DomainException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Binds the resolved tenant to the request for its whole lifetime. Registered before Spring Security
 * so that security rules (e.g. "token tenant must match request tenant") can rely on it.
 */
public class TenantFilter extends OncePerRequestFilter {

    private final TenantResolver resolver;
    private final JsonMapper json;

    TenantFilter(TenantResolver resolver, JsonMapper json) {
        this.resolver = resolver;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Tenant tenant;
        try {
            tenant = resolver.resolve(request);
        } catch (DomainException ex) {
            writeProblem(response, ex, request);
            return;
        }
        response.setHeader(TenantResolver.HEADER, tenant.id());
        try {
            TenantContext.callAs(tenant, () -> {
                chain.doFilter(request, response);
                return null;
            });
        } catch (IOException | ServletException | RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new ServletException(e);
        }
    }

    private void writeProblem(HttpServletResponse response, DomainException ex, HttpServletRequest request)
            throws IOException {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
        pd.setType(ex.type());
        pd.setTitle(ex.title());
        pd.setInstance(java.net.URI.create(request.getRequestURI()));
        pd.setProperty("timestamp", Instant.now().toString());
        response.setStatus(ex.status().value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        json.writeValue(response.getOutputStream(), pd);
    }

    @Configuration(proxyBeanMethods = false)
    static class Registration {

        @Bean
        FilterRegistrationBean<TenantFilter> tenantFilter(TenantResolver resolver, JsonMapper json) {
            var bean = new FilterRegistrationBean<>(new TenantFilter(resolver, json));
            bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
            bean.addUrlPatterns("/*");
            return bean;
        }
    }
}
