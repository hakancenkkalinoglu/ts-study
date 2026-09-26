package com.testpsikolog.dto;

/** clinicId: boşsa değişmez; 0 = kişisel (klinik yok); aksi halde psikoloğun üyesi olduğu klinik. */
public record UpdateClientRequest(
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
