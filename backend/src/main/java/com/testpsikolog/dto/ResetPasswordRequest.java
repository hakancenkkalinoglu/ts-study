package com.testpsikolog.dto;

public record ResetPasswordRequest(String email, String code, String newPassword) {
}
