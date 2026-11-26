package com.tradechameleon.shared;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Renders every error as RFC 9457 Problem Details ({@code application/problem+json}).
 *
 * <p>Spring MVC already produces {@link ProblemDetail} for its own exceptions (400, 404, 405, 415...).
 * This advice adds our {@link DomainException} hierarchy, field-level validation errors and a safe
 * catch-all for unexpected failures. Every problem gets a {@code timestamp} property.
 */
@RestControllerAdvice
public class ProblemDetailsAdvice extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAdvice.class);

    @ExceptionHandler(DomainException.class)
    ProblemDetail domain(DomainException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
        pd.setType(ex.type());
        pd.setTitle(ex.title());
        ex.properties().forEach(pd::setProperty);
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    /** Security exceptions must reach Spring Security's ExceptionTranslationFilter (401/403 handling). */
    @ExceptionHandler({AccessDeniedException.class, AuthenticationException.class})
    void rethrowSecurity(RuntimeException ex) {
        throw ex;
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail unexpected(Exception ex) {
        log.error("Unexpected error", ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on our side. The error has been logged.");
        pd.setTitle("Internal error");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    /** Adds a {@code errors} map (field -> message) to bean validation failures. */
    @Override
    protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail pd = ex.getBody();
        pd.setType(java.net.URI.create(DomainException.PROBLEM_BASE + "validation"));
        pd.setTitle("Validation failed");
        pd.setDetail("The request contains invalid fields.");
        var errors = new java.util.LinkedHashMap<String, String>();
        ex.getBindingResult().getFieldErrors()
                .forEach(fe -> errors.putIfAbsent(fe.getField(), fe.getDefaultMessage()));
        pd.setProperty("errors", errors);
        pd.setProperty("timestamp", Instant.now());
        return handleExceptionInternal(ex, pd, headers, status, request);
    }
}
