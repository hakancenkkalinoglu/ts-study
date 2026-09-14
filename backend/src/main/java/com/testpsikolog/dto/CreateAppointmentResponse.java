package com.testpsikolog.dto;

public record CreateAppointmentResponse(
        long id,
        int createdCount,
        String googleMeetLink,
        String googleHtmlLink
) {
}
