package com.testpsikolog.dto;

public record UpdateBlockedSlotRequest(String slotDate, String startTime, String endTime, String title) {
}
