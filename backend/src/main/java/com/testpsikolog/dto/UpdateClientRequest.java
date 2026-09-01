package com.testpsikolog.dto;

public record UpdateClientRequest(
        String email,
        String name,
        String birthDate,
        Integer agreedFee,
        String password
) {
}
