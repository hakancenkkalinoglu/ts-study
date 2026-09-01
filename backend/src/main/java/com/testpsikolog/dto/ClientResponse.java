package com.testpsikolog.dto;

public record ClientResponse(
        long id,
        String email,
        String name,
        String birthDate,
        Integer agreedFee,
        String createdAt,
        String updatedAt
) {
}
