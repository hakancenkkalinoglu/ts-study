package com.testpsikolog.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class LoginThrottle {

    private static final int MAX_FAILURES = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 10_000;

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public void assertAllowed(String key) {
        String normalized = normalize(key);
        Attempt attempt = attempts.get(normalized);
        if (attempt == null || attempt.lockedUntil() == null) {
            return;
        }
        Instant now = Instant.now();
        if (now.isBefore(attempt.lockedUntil())) {
            long minutes = (Duration.between(now, attempt.lockedUntil()).getSeconds() + 59) / 60;
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Çok fazla hatalı deneme. " + Math.max(1, minutes) + " dakika sonra tekrar deneyin."
            );
        }
        attempts.remove(normalized);
    }

    public void recordFailure(String key) {
        Instant now = Instant.now();
        if (attempts.size() > MAX_TRACKED_KEYS) {
            attempts.entrySet().removeIf(entry -> isExpired(entry.getValue(), now));
        }
        attempts.compute(normalize(key), (ignored, current) -> {
            boolean restart = current == null
                    || current.lockedUntil() != null
                    || current.windowStart().plus(FAILURE_WINDOW).isBefore(now);
            int failures = restart ? 1 : current.failures() + 1;
            Instant windowStart = restart ? now : current.windowStart();
            Instant lockedUntil = failures >= MAX_FAILURES ? now.plus(LOCK_DURATION) : null;
            return new Attempt(failures, windowStart, lockedUntil);
        });
    }

    public void reset(String key) {
        attempts.remove(normalize(key));
    }

    private static boolean isExpired(Attempt attempt, Instant now) {
        if (attempt.lockedUntil() != null) {
            return attempt.lockedUntil().isBefore(now);
        }
        return attempt.windowStart().plus(FAILURE_WINDOW).isBefore(now);
    }

    private static String normalize(String key) {
        return key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
    }

    private record Attempt(int failures, Instant windowStart, Instant lockedUntil) {
    }
}
