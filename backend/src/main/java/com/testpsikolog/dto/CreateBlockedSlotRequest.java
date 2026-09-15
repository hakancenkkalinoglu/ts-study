package com.testpsikolog.dto;

public record CreateBlockedSlotRequest(String slotDate, String startTime, String endTime, String title) {
}
