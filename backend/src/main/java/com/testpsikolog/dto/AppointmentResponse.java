package com.testpsikolog.dto;

public record AppointmentResponse(
        long id,
        long clientId,
        String appointmentDate,
        String appointmentTime,
        String title,
        int isPaid,
        String googleEventId,
        String googleMeetLink,
        String googleHtmlLink,
        String createdAt,
        String updatedAt,
        String clientName,
        Integer agreedFee
) {
}
