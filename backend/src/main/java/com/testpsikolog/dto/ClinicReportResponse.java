package com.testpsikolog.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Psikoloğun kendi kazancı. Tutarlar TL. {@code clinicShare}, kliniğin odalarında yapılan iptal olmayan
 * tüm seanslardan doğan oda payıdır (danışan ödese de ödemese de); {@code netAmount} = tahsilat − oda payı.
 */
public record ClinicReportResponse(
        String from,
        String to,
        int sessions,
        long paidAmount,
        long pendingAmount,
        BigDecimal clinicShare,
        BigDecimal sharePaid,
        BigDecimal shareRemaining,
        List<TherapistReport> therapists
) {
    public record TherapistReport(
            long userId,
            String name,
            int sessions,
            long paidAmount,
            long pendingAmount,
            BigDecimal clinicShare,
            BigDecimal sharePaid,
            BigDecimal shareRemaining,
            BigDecimal netAmount,
            BigDecimal currentPercent
    ) {
    }
}
