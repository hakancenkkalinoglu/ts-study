package com.testpsikolog.dto;

public record UpdateClientRequest(
        String email,
        String name,
        String birthDate,
        Integer agreedFee,
        String password,
        String phone,
        String emergencyName,
        String emergencyPhone
) {
}
