package com.testpsikolog.security;

import com.testpsikolog.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final Set<String> INSECURE_SECRETS = Set.of(
            "testpsikolog-secret-change-in-production",
            "your-secret-key-change-in-production",
            "change-me"
    );

    private final AppProperties appProperties;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
        ensureSecret();
    }

    public String createToken(long userId, String username) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + appProperties.getJwtExpirationMs());
        return Jwts.builder()
                .subject(username)
                .claim("username", username)
                .claim("uid", userId)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey())
                .compact();
    }

    public AuthUser parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        String username = claims.get("username", String.class);
        if (username == null || username.isBlank()) {
            username = claims.getSubject();
        }
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Token gecersiz.");
        }
        Long userId = claims.get("uid", Long.class);
        if (userId == null) {
            Number uid = claims.get("uid", Number.class);
            userId = uid == null ? null : uid.longValue();
        }
        return new AuthUser(userId, username, null);
    }

    private SecretKey signingKey() {
        byte[] bytes = appProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, bytes.length);
            bytes = padded;
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    private void ensureSecret() {
        if (!isInsecureSecret(appProperties.getJwtSecret())) {
            return;
        }
        byte[] random = new byte[48];
        new SecureRandom().nextBytes(random);
        appProperties.setJwtSecret(Base64.getEncoder().encodeToString(random));
        System.out.println(
                "JWT_SECRET missing or using a known default. A random secret was generated for this process; sessions will not survive restart."
        );
    }

    private static boolean isInsecureSecret(String secret) {
        if (secret == null || secret.isBlank() || secret.length() < 32) {
            return true;
        }
        return INSECURE_SECRETS.contains(secret.trim());
    }
}
