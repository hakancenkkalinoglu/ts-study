package com.testpsikolog.dto;

import java.math.BigDecimal;
import java.util.List;

public record CommissionOverviewResponse(
        BigDecimal defaultPercent,
        List<CommissionMemberResponse> members
) {
}
