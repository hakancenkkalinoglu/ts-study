package com.testpsikolog.dto;

public record CreateAppointmentRequest(
        String appointmentDate,
        String appointmentTime,
        String title,
        Boolean isPaid,
        String status,
        Long roomId,
        Integer durationMinutes,
        Integer sessionFee
) {
}
