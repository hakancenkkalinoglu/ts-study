package com.testpsikolog.dto;

import java.math.BigDecimal;

public record SharePaymentResponse(long id, BigDecimal amount, String paidOn, String note) {
}
