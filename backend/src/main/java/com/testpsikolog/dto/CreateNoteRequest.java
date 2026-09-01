package com.testpsikolog.dto;

public record CreateNoteRequest(
        Long clientId,
        Long appointmentId,
        String title,
        String content,
        String noteDate
) {
}
