package com.tradechameleon.simulator;

import com.tradechameleon.shared.DomainException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Injects latency and failures into business API calls so the front-ends can practise loading
 * states, retries and error handling.
 *
 * <p>{@code Thread.sleep} is fine here: requests run on virtual threads, so a sleeping request parks
 * its virtual thread and frees the carrier thread for other work.
 */
class ChaosInterceptor implements HandlerInterceptor {

    private final Simulator simulator;

    ChaosInterceptor(Simulator simulator) {
        this.simulator = simulator;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws InterruptedException {
        var s = simulator.settings();
        long delay = s.latencyMs() + (s.jitterMs() > 0 ? ThreadLocalRandom.current().nextInt(s.jitterMs() + 1) : 0);
        if (delay > 0) {
            Thread.sleep(delay);
        }
        if (s.failureRate() > 0 && ThreadLocalRandom.current().nextDouble() < s.failureRate()) {
            throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, "simulated-failure", "Simulated failure",
                    "The simulator injected a failure (failureRate=" + s.failureRate() + "). Try again.",
                    Map.of("retryable", true));
        }
        return true;
    }

    @Configuration(proxyBeanMethods = false)
    static class Registration implements WebMvcConfigurer {

        private final Simulator simulator;

        Registration(Simulator simulator) {
            this.simulator = simulator;
        }

        @Override
        public void addInterceptors(InterceptorRegistry registry) {
            registry.addInterceptor(new ChaosInterceptor(simulator))
                    .addPathPatterns("/api/**")
                    .excludePathPatterns("/api/simulator/**", "/api/auth/**", "/api/tenants/**",
                            "/api/market/stream");
        }
    }
}
