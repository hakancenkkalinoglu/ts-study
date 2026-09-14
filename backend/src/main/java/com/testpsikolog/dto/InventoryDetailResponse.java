package com.testpsikolog.dto;

import java.util.List;

public record InventoryDetailResponse(
        long id,
        String code,
        String name,
        String description,
        int maxScore,
        List<InventoryItemResponse> items
) {
}
