package com.testpsikolog.dto;

public record InventorySummaryResponse(long id, String code, String name, String description, int maxScore, int itemCount) {
}
