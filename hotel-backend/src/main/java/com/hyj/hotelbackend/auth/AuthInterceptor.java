package com.hyj.hotelbackend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;

    public AuthInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                             @NonNull Object handler) {
        String path = request.getRequestURI();
        // Public endpoints
        if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register") || path.startsWith("/api/health") || path.startsWith("/api/chat")) {
            return true;
        }
        // Allow public browsing endpoints, attach user context if token exists
        if (HttpMethod.GET.matches(request.getMethod()) && (path.startsWith("/api/rooms") || path.startsWith("/api/hotel") || path.startsWith("/api/pricing"))) {
            attachUserIfPresent(request);
            return true;
        }
        // Allow preflight
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "缺少或非法的 Authorization 头");
        }
        String token = auth.substring(7);
        try {
            CurrentUserHolder.set(parseToken(token));
            return true;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token 无效或已过期");
        }
    }

    @Override
    public void afterCompletion(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                @NonNull Object handler, @Nullable Exception ex) {
        CurrentUserHolder.clear();
    }

    private void attachUserIfPresent(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return;
        }
        String token = auth.substring(7);
        try {
            CurrentUserHolder.set(parseToken(token));
        } catch (Exception ignored) {
            // ignore invalid token for public endpoints
        }
    }

    private AuthUser parseToken(String token) {
        JwtUtil.JwtPayload payload = jwtUtil.parse(token);
        Long userId = Long.valueOf(payload.sub);
        String username = payload.username;
        String role = payload.role;
        Integer vipLevel = payload.vipLevel;
        return new AuthUser(userId, username, role, vipLevel);
    }
}
