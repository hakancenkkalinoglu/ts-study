package com.testpsikolog.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Klinik sahibinin oda ücreti raporu. Bilerek psikologların tahsilatını, net kazancını veya danışan bilgisini
 * içermez; yalnızca oda payı, ödenen ve kalan tutarlar verilir.
 *
 * @param status none = bu ay pay yok, paid = ödendi, partial = kısmen ödendi, unpaid = ödenmedi
 * @param cumulativeRemaining Bu ay dahil, önceki tüm aylardan kalan borç.
 */
public record ClinicFeeReportResponse(
        String month,
        BigDecimal totalOwed,
        BigDecimal totalPaid,
        BigDecimal totalRemaining,
        BigDecimal totalCumulativeRemaining,
        List<TherapistFee> therapists
) {
    public record TherapistFee(
            long userId,
            String name,
            int sessions,
            BigDecimal percent,
            BigDecimal owed,
            BigDecimal paid,
            BigDecimal remaining,
            BigDecimal cumulativeRemaining,
            String status,
            List<SharePaymentResponse> payments
    ) {
    }
}
