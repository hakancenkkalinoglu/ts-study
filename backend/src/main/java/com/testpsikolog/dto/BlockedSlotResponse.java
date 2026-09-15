package com.testpsikolog.dto;

public record BlockedSlotResponse(
        long id,
        String slotDate,
        String startTime,
        String endTime,
        String title
) {
}
