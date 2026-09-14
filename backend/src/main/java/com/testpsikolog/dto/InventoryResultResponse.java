package com.testpsikolog.dto;

public record InventoryResultResponse(
        long id,
        long inventoryId,
        String inventoryName,
        int score,
        int maxScore,
        String interpretation,
        String createdAt
) {
}
