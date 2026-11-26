package com.tradechameleon.shared;

import java.net.URI;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Base class for business errors. {@link ProblemDetailsAdvice} turns every subclass
 * into an RFC 9457 {@code application/problem+json} response.
 */
public class DomainException extends RuntimeException {

    public static final String PROBLEM_BASE = "https://tradechameleon.dev/problems/";

    private final HttpStatus status;
    private final String problemSlug;
    private final String title;
    private final Map<String, Object> properties;

    public DomainException(HttpStatus status, String problemSlug, String title, String detail) {
        this(status, problemSlug, title, detail, Map.of());
    }

    public DomainException(HttpStatus status, String problemSlug, String title, String detail,
                           Map<String, Object> properties) {
        super(detail);
        this.status = status;
        this.problemSlug = problemSlug;
        this.title = title;
        this.properties = properties;
    }

    public HttpStatus status() {
        return status;
    }

    public URI type() {
        return URI.create(PROBLEM_BASE + problemSlug);
    }

    public String title() {
        return title;
    }

    public Map<String, Object> properties() {
        return properties;
    }

    // ---- common factories -------------------------------------------------------------------

    public static DomainException notFound(String what, String id) {
        return new DomainException(HttpStatus.NOT_FOUND, "not-found", what + " not found",
                what + " '" + id + "' does not exist.");
    }

    public static DomainException forbidden(String slug, String title, String detail) {
        return new DomainException(HttpStatus.FORBIDDEN, slug, title, detail);
    }

    public static DomainException unprocessable(String slug, String title, String detail, Map<String, Object> props) {
        return new DomainException(HttpStatus.UNPROCESSABLE_CONTENT, slug, title, detail, props);
    }
}
