package com.hyj.hotelbackend.auth;

public class CurrentUserHolder {
    private static final ThreadLocal<AuthUser> CTX = new ThreadLocal<>();

    public static void set(AuthUser user) {
        CTX.set(user);
    }

    public static AuthUser get() {
        return CTX.get();
    }

    public static void clear() {
        CTX.remove();
    }
}

