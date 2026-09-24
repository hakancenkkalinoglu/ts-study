package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.RecordSharePaymentRequest;
import com.testpsikolog.dto.SharePaymentResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Psikoloğun kliniğe ödediği oda payı kayıtları. Kayıt hangi ayın payına sayılacağıyla girilir. */
@Service
public class SharePaymentService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");
    private static final BigDecimal MAX = BigDecimal.valueOf(10_000_000);

    private final JdbcTemplate jdbc;
    private final ClinicService clinicService;

    public SharePaymentService(JdbcTemplate jdbc, ClinicService clinicService) {
        this.jdbc = jdbc;
        this.clinicService = clinicService;
    }

    public SharePaymentResponse record(long userId, RecordSharePaymentRequest request) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.MANAGE_PAYMENTS);
        if (request == null || request.userId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Psikolog seçin.");
        }
        boolean payer = clinic.members().stream()
                .anyMatch(m -> m.userId() == request.userId() && m.userId() != clinic.ownerUserId());
        if (!payer) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu kişi için ödeme kaydı girilemez.");
        }
        BigDecimal amount = request.amount() == null ? null : request.amount().setScale(2, RoundingMode.HALF_UP);
        if (amount == null || amount.signum() <= 0 || amount.compareTo(MAX) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tutar sıfırdan büyük olmalı.");
        }
        String period = parsePeriod(request.period());
        String paidOn = parseDate(request.paidOn());
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        if (note != null && note.length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not en fazla 200 karakter olabilir.");
        }
        Long id = jdbc.queryForObject(
                """
                INSERT INTO clinic_share_payments (clinicId, userId, period, amount, paidOn, note, createdBy, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, utc_now_text()) RETURNING id
                """,
                Long.class,
                clinic.id(),
                request.userId(),
                period,
                amount,
                paidOn,
                note,
                userId
        );
        return new SharePaymentResponse(id == null ? 0L : id, amount, paidOn, note);
    }

    public void delete(long userId, long paymentId) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.MANAGE_PAYMENTS);
        int deleted = jdbc.update(
                "DELETE FROM clinic_share_payments WHERE id = ? AND clinicId = ?",
                paymentId,
                clinic.id()
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ödeme kaydı bulunamadı.");
        }
    }

    private static String parsePeriod(String value) {
        try {
            return YearMonth.parse(value == null ? "" : value.trim()).toString();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dönem YYYY-AA biçiminde olmalı.");
        }
    }

    private static String parseDate(String value) {
        if (value == null || value.isBlank()) {
            return LocalDate.now(ZONE).toString();
        }
        try {
            return LocalDate.parse(value.trim()).toString();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tarih YYYY-AA-GG biçiminde olmalı.");
        }
    }
}
