package com.testpsikolog.dto;

public record NoteResponse(
        long id,
        long clientId,
        Long appointmentId,
        String title,
        String content,
        String fileName,
        String noteDate,
        String createdAt,
        String updatedAt,
        String createdByName,
        String updatedByName
) {
}
