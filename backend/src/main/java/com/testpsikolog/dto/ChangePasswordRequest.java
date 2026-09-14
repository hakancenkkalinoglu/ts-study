package com.testpsikolog.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {
}
