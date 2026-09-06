package com.testpsikolog.dto;

public record UpdateAppointmentRequest(
        String appointmentDate,
        String appointmentTime,
        String title,
        Boolean isPaid,
        String status,
        Long roomId
) {
}
