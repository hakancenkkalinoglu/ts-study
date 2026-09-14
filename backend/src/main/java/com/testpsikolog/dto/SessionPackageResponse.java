package com.testpsikolog.dto;

public record SessionPackageResponse(
        long id,
        long clientId,
        String title,
        int totalSessions,
        int remainingSessions,
        int prepaidAmount,
        String createdAt
) {
}
