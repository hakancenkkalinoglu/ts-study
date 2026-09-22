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
    private static final String OAUTH_STATE_PURPOSE = "google-oauth";
    private static final String OAUTH_MODE_SIGN_IN = "signin";
    private static final String OAUTH_MODE_LINK = "link";
    private static final long OAUTH_STATE_TTL_MS = 10 * 60 * 1000L;

    private final AppProperties appProperties;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
        ensureSecret();
    }

    public String createToken(long userId, String username, int tokenVersion) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + appProperties.getJwtExpirationMs());
        return Jwts.builder()
                .subject(username)
                .claim("username", username)
                .claim("uid", userId)
                .claim("tv", tokenVersion)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey())
                .compact();
    }

    public AuthUser parse(String token) {
        Claims claims = readClaims(token);
        if (claims.get("purpose") != null) {
            throw new IllegalArgumentException("Token gecersiz.");
        }
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

    public int tokenVersion(String token) {
        Number version = readClaims(token).get("tv", Number.class);
        return version == null ? 0 : version.intValue();
    }

    public String createOAuthState(Long userId) {
        Date now = new Date();
        var builder = Jwts.builder()
                .claim("purpose", OAUTH_STATE_PURPOSE)
                .claim("mode", userId == null ? OAUTH_MODE_SIGN_IN : OAUTH_MODE_LINK)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + OAUTH_STATE_TTL_MS))
                .signWith(signingKey());
        if (userId != null) {
            builder.claim("uid", userId);
        }
        return builder.compact();
    }

    public OAuthState parseOAuthState(String state) {
        if (state == null || state.isBlank()) {
            throw new IllegalArgumentException("OAuth state missing.");
        }
        Claims claims = readClaims(state);
        if (!OAUTH_STATE_PURPOSE.equals(claims.get("purpose", String.class))) {
            throw new IllegalArgumentException("OAuth state invalid.");
        }
        String mode = claims.get("mode", String.class);
        if (OAUTH_MODE_SIGN_IN.equals(mode)) {
            return new OAuthState(true, null);
        }
        Number uid = claims.get("uid", Number.class);
        if (!OAUTH_MODE_LINK.equals(mode) || uid == null) {
            throw new IllegalArgumentException("OAuth state invalid.");
        }
        return new OAuthState(false, uid.longValue());
    }

    private Claims readClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
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

    public record OAuthState(boolean signIn, Long userId) {
    }
}
