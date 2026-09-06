package com.testpsikolog.dto;

public record CreateClientRequest(
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
