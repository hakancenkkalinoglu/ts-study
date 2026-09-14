package com.testpsikolog.dto;

public record UpdateProfileRequest(String displayName, String email, Integer reminderHours) {
}
