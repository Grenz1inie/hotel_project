package com.hyj.hotelbackend.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    private final byte[] secretBytes;
    private final int expiresHours;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expires-hours:12}") int expiresHours) {
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        this.expiresHours = expiresHours;
    }

    public String generateToken(Long userId, String username, String role, Integer vipLevel) {
        String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
        long now = Instant.now().getEpochSecond();
        long exp = Instant.now().plus(expiresHours, ChronoUnit.HOURS).getEpochSecond();
        String payloadJson = String.format("{\"sub\":\"%s\",\"username\":\"%s\",\"role\":\"%s\",\"vipLevel\":%d,\"iat\":%d,\"exp\":%d}",
                userId, escape(username), escape(role), vipLevel == null ? 0 : vipLevel, now, exp);
        String headerB64 = base64UrlEncode(headerJson.getBytes(StandardCharsets.UTF_8));
        String payloadB64 = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signingInput = headerB64 + "." + payloadB64;
        String signature = sign(signingInput);
        return signingInput + "." + signature;
    }

    public JwtPayload parse(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw new RuntimeException("Invalid token");
        String signingInput = parts[0] + "." + parts[1];
        String expectedSig = sign(signingInput);
        if (!constantTimeEquals(expectedSig, parts[2])) throw new RuntimeException("Invalid signature");
        String payloadJson = new String(base64UrlDecode(parts[1]), StandardCharsets.UTF_8);
        Map<String, Object> map = parseJson(payloadJson);
        long exp = ((Number) map.getOrDefault("exp", 0)).longValue();
        long now = Instant.now().getEpochSecond();
        if (now >= exp) throw new RuntimeException("Token expired");
        JwtPayload payload = new JwtPayload();
        payload.sub = String.valueOf(map.get("sub"));
        payload.username = (String) map.get("username");
        payload.role = (String) map.get("role");
        Object vl = map.get("vipLevel");
        if (vl instanceof Number) payload.vipLevel = ((Number) vl).intValue();
        else payload.vipLevel = 0;
        payload.exp = exp;
        return payload;
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretBytes, "HmacSHA256"));
            byte[] sig = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return base64UrlEncode(sig);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static String base64UrlEncode(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private static byte[] base64UrlDecode(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) {
            result |= a.charAt(i) ^ b.charAt(i);
        }
        return result == 0;
    }

    // Very small JSON parser for flat objects with primitives; assumes well-formed input from generateToken
    private static Map<String, Object> parseJson(String json) {
        Map<String, Object> map = new HashMap<>();
        String s = json.trim();
        if (s.startsWith("{") && s.endsWith("}")) {
            s = s.substring(1, s.length() - 1).trim();
            if (s.isEmpty()) return map;
            String[] parts = s.split(",");
            for (String part : parts) {
                String[] kv = part.split(":", 2);
                if (kv.length != 2) continue;
                String key = unquote(kv[0].trim());
                String value = kv[1].trim();
                if (value.startsWith("\"")) {
                    map.put(key, unquote(value));
                } else if (value.equals("true") || value.equals("false")) {
                    map.put(key, Boolean.parseBoolean(value));
                } else {
                    try {
                        if (value.contains(".")) map.put(key, Double.parseDouble(value));
                        else map.put(key, Long.parseLong(value));
                    } catch (NumberFormatException e) {
                        map.put(key, value);
                    }
                }
            }
        }
        return map;
    }

    private static String unquote(String s) {
        s = s.trim();
        if (s.startsWith("\"") && s.endsWith("\"")) {
            return s.substring(1, s.length() - 1).replace("\\\"", "\"");
        }
        return s;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public static class JwtPayload {
        public String sub;
        public String username;
        public String role;
        public Integer vipLevel;
        public long exp;
    }
}
