package com.testpsikolog.security;

import com.testpsikolog.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final AppProperties appProperties;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
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
}
