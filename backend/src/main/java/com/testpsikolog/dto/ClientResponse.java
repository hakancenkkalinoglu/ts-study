package com.testpsikolog.dto;

public record ClientResponse(
        long id,
        String email,
        String name,
        String birthDate,
        Integer agreedFee,
        String phone,
        String emergencyName,
        String emergencyPhone,
        String createdAt,
        String updatedAt,
        String createdByName,
        String updatedByName
) {
}
