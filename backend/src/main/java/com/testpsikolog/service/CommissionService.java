package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicMemberResponse;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.CommissionMemberResponse;
import com.testpsikolog.dto.CommissionOverviewResponse;
import com.testpsikolog.dto.SetCommissionRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Klinik payı yüzdeleri. Her kayıt bir geçerlilik tarihiyle tutulur; bir seans için oran,
 * seans tarihinde geçerli en son kayıttır. Psikolog bazlı kayıtta {@code percent = NULL}
 * "klinik varsayılanına dön" anlamına gelir.
 */
@Service
public class CommissionService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");

    private final JdbcTemplate jdbc;
    private final ClinicService clinicService;

    public CommissionService(JdbcTemplate jdbc, ClinicService clinicService) {
        this.jdbc = jdbc;
        this.clinicService = clinicService;
    }

    /** Klinikte, verilen psikolog için, verilen günde geçerli klinik payı yüzdesi. */
    public BigDecimal rateFor(long clinicId, long userId, String date) {
        Individual individual = jdbc.query(
                """
                SELECT percent FROM commission_rates
                WHERE clinicId = ? AND userId = ? AND validFrom <= ?
                ORDER BY validFrom DESC, id DESC LIMIT 1
                """,
                rs -> rs.next() ? new Individual(rs.getBigDecimal("percent")) : null,
                clinicId,
                userId,
                date
        );
        if (individual != null && individual.percent() != null) {
            return individual.percent();
        }
        return defaultRate(clinicId, date);
    }

    public BigDecimal defaultRate(long clinicId, String date) {
        BigDecimal percent = jdbc.query(
                """
                SELECT percent FROM commission_rates
                WHERE clinicId = ? AND userId IS NULL AND validFrom <= ?
                ORDER BY validFrom DESC, id DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getBigDecimal("percent") : null,
                clinicId,
                date
        );
        return percent == null ? BigDecimal.ZERO : percent;
    }

    public CommissionOverviewResponse overview(long userId) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.SET_COMMISSION);
        String today = today();
        List<CommissionMemberResponse> members = new ArrayList<>();
        for (ClinicMemberResponse member : clinic.members()) {
            BigDecimal effective = rateFor(clinic.id(), member.userId(), today);
            members.add(new CommissionMemberResponse(
                    member.userId(),
                    member.name(),
                    effective,
                    hasCustomRate(clinic.id(), member.userId(), today)
            ));
        }
        return new CommissionOverviewResponse(defaultRate(clinic.id(), today), members);
    }

    @Transactional
    public CommissionOverviewResponse setDefault(long userId, SetCommissionRequest request) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.SET_COMMISSION);
        BigDecimal percent = requirePercent(request);
        insert(clinic.id(), null, percent, resolveDate(request));
        return overview(userId);
    }

    @Transactional
    public CommissionOverviewResponse setForMember(long userId, long memberUserId, SetCommissionRequest request) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.SET_COMMISSION);
        requireMember(clinic, memberUserId);
        BigDecimal percent = request == null ? null : request.percent();
        if (percent != null) {
            validatePercent(percent);
        }
        insert(clinic.id(), memberUserId, percent, resolveDate(request));
        return overview(userId);
    }

    /** Varsayılanı günceller ve psikolog bazlı istisnaları aynı tarihten itibaren kaldırır. */
    @Transactional
    public CommissionOverviewResponse applyToAll(long userId, SetCommissionRequest request) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.SET_COMMISSION);
        BigDecimal percent = requirePercent(request);
        String validFrom = resolveDate(request);
        insert(clinic.id(), null, percent, validFrom);
        List<Long> customized = jdbc.queryForList(
                "SELECT DISTINCT userId FROM commission_rates WHERE clinicId = ? AND userId IS NOT NULL",
                Long.class,
                clinic.id()
        );
        for (Long memberId : customized) {
            insert(clinic.id(), memberId, null, validFrom);
        }
        return overview(userId);
    }

    private boolean hasCustomRate(long clinicId, long userId, String date) {
        Boolean custom = jdbc.query(
                """
                SELECT percent IS NOT NULL AS custom FROM commission_rates
                WHERE clinicId = ? AND userId = ? AND validFrom <= ?
                ORDER BY validFrom DESC, id DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getBoolean("custom") : Boolean.FALSE,
                clinicId,
                userId,
                date
        );
        return Boolean.TRUE.equals(custom);
    }

    /** Aynı (klinik, psikolog, tarih) için tek kayıt kalır; yeniden girilirse üzerine yazılır. */
    private void insert(long clinicId, Long memberUserId, BigDecimal percent, String validFrom) {
        if (memberUserId == null) {
            jdbc.update(
                    "DELETE FROM commission_rates WHERE clinicId = ? AND userId IS NULL AND validFrom = ?",
                    clinicId,
                    validFrom
            );
        } else {
            jdbc.update(
                    "DELETE FROM commission_rates WHERE clinicId = ? AND userId = ? AND validFrom = ?",
                    clinicId,
                    memberUserId,
                    validFrom
            );
        }
        jdbc.update(
                "INSERT INTO commission_rates (clinicId, userId, percent, validFrom, createdAt) VALUES (?, ?, ?, ?, utc_now_text())",
                clinicId,
                memberUserId,
                percent,
                validFrom
        );
    }

    private static void requireMember(ClinicResponse clinic, long memberUserId) {
        boolean found = clinic.members().stream().anyMatch(m -> m.userId() == memberUserId);
        if (!found) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Üye bulunamadı.");
        }
    }

    private static BigDecimal requirePercent(SetCommissionRequest request) {
        BigDecimal percent = request == null ? null : request.percent();
        if (percent == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yüzde gerekli.");
        }
        validatePercent(percent);
        return percent;
    }

    private static void validatePercent(BigDecimal percent) {
        if (percent.signum() < 0 || percent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yüzde 0 ile 100 arasında olmalı.");
        }
    }

    private static String resolveDate(SetCommissionRequest request) {
        String value = request == null ? null : request.validFrom();
        if (value == null || value.isBlank()) {
            return today();
        }
        try {
            return LocalDate.parse(value.trim()).toString();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerlilik tarihi YYYY-AA-GG biçiminde olmalı.");
        }
    }

    private static String today() {
        return LocalDate.now(ZONE).toString();
    }

    private record Individual(BigDecimal percent) {
    }
}
