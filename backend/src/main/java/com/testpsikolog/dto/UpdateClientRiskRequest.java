package com.testpsikolog.dto;

public record UpdateClientRiskRequest(
        String level,
        String note
) {
}
