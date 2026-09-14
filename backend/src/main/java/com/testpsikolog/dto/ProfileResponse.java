package com.testpsikolog.dto;

public record ProfileResponse(
        long id,
        String email,
        String username,
        String displayName,
        boolean googleConnected,
        int reminderHours
) {
}
