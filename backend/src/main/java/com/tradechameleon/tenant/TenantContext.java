package com.tradechameleon.tenant;

/**
 * Holds the tenant of the current request in a Java 25 {@link ScopedValue}.
 *
 * <p>Unlike a {@code ThreadLocal}, a scoped value is immutable, automatically cleared when the scope
 * ends and cheap to inherit, which makes it a natural fit for virtual threads.
 */
public final class TenantContext {

    static final ScopedValue<Tenant> CURRENT = ScopedValue.newInstance();

    private TenantContext() {
    }

    /** The tenant bound to the current request. Fails fast outside a request scope. */
    public static Tenant current() {
        if (!CURRENT.isBound()) {
            throw new IllegalStateException("No tenant bound to the current scope");
        }
        return CURRENT.get();
    }

    public static boolean isBound() {
        return CURRENT.isBound();
    }

    /** Runs {@code op} with {@code tenant} bound; used by the filter and by tests. */
    public static <R, X extends Throwable> R callAs(Tenant tenant, ScopedValue.CallableOp<R, X> op) throws X {
        return ScopedValue.where(CURRENT, tenant).call(op);
    }
}
