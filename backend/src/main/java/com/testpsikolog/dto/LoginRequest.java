package com.testpsikolog.dto;

public record LoginRequest(String email, String username, String password, String displayName) {
    public String loginId() {
        if (email != null && !email.isBlank()) {
            return email.trim();
        }
        if (username != null && !username.isBlank()) {
            return username.trim();
        }
        return null;
    }
}
