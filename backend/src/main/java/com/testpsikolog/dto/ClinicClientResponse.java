package com.testpsikolog.dto;

/** Sekreterin randevu oluştururken gördüğü, kliniğe ait bir danışanın temel bilgisi. */
public record ClinicClientResponse(
        long id,
        String name,
        String email,
        String phone,
        long therapistUserId,
        String therapistName
) {
}
