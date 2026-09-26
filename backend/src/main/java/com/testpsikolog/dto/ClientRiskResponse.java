package com.testpsikolog.dto;

public record ClientRiskResponse(
        String level,
        String note,
        String updatedAt
) {
}
