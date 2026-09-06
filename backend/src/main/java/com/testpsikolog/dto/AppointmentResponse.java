package com.testpsikolog.dto;

public record AppointmentResponse(
        long id,
        long clientId,
        String appointmentDate,
        String appointmentTime,
        String title,
        int isPaid,
        String status,
        String googleEventId,
        String googleMeetLink,
        String googleHtmlLink,
        String createdAt,
        String updatedAt,
        String clientName,
        Integer agreedFee,
        String clientEmail,
        Long clinicId,
        Long roomId,
        String roomName,
        String roomColor,
        Long therapistUserId,
        String therapistName,
        boolean mine
) {
}
