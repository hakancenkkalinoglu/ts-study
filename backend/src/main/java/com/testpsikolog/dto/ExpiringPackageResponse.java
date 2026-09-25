package com.testpsikolog.dto;

public record ExpiringPackageResponse(
        long packageId,
        long clientId,
        String clientName,
        String title,
        int totalSessions,
        int remainingSessions
) {
}
