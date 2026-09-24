package com.testpsikolog.dto;

import java.math.BigDecimal;

public record CommissionMemberResponse(
        long userId,
        String name,
        BigDecimal percent,
        boolean custom
) {
}
