package com.testpsikolog.dto;

import java.math.BigDecimal;

/**
 * @param period YYYY-AA; hangi ayın oda payına sayılacağı.
 * @param paidOn YYYY-AA-GG; boşsa bugün.
 */
public record RecordSharePaymentRequest(Long userId, String period, BigDecimal amount, String paidOn, String note) {
}
