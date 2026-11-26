package com.tradechameleon.identity;

import java.util.List;

/** The logged-in user as the clients see it. */
public record UserProfile(String id, String name, String email, List<String> roles, String tenant) {
}
