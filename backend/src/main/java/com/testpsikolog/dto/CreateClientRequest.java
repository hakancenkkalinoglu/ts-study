package com.testpsikolog.dto;

/** clinicId: boşsa tek kliniği olan psikologda o klinik, kliniği yoksa kişisel; 0 = kişisel (klinik yok). */
public record CreateClientRequest(
        String email,
        String name,
        String birthDate,
        Integer agreedFee,
        String password,
        String phone,
        String emergencyName,
        String emergencyPhone,
        Long clinicId
) {
}
