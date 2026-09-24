package com.testpsikolog.service;

import com.testpsikolog.dto.ClinicFeeReportResponse;
import com.testpsikolog.dto.ClinicFeeReportResponse.TherapistFee;
import com.testpsikolog.dto.ClinicMemberResponse;
import com.testpsikolog.dto.ClinicReportResponse;
import com.testpsikolog.dto.ClinicReportResponse.TherapistReport;
import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.SharePaymentResponse;
import com.testpsikolog.util.ScheduleInputs;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Oda payı hesabı. Kliniğin odalarında yapılan, iptal olmayan tüm seanslar pay doğurur (danışan ödese de
 * ödemese de). Pay = seans tutarı × seans tarihinde geçerli yüzde; seans tutarı sessionFee, yoksa agreedFee,
 * yoksa 0. Kurucunun kendi seanslarından pay alınmaz. Psikoloğun kliniğe yaptığı ödemeler
 * {@code clinic_share_payments} tablosunda ay bazında tutulur.
 */
@Service
public class ClinicReportService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final String BEGINNING = "2000-01-01";

    private final JdbcTemplate jdbc;
    private final ClinicService clinicService;
    private final CommissionService commissionService;

    public ClinicReportService(JdbcTemplate jdbc, ClinicService clinicService, CommissionService commissionService) {
        this.jdbc = jdbc;
        this.clinicService = clinicService;
        this.commissionService = commissionService;
    }

    /** Klinik sahibi için oda ücreti raporu: kim ne kadar borçlu, ne kadar ödedi. Tahsilat/net kazanç içermez. */
    public ClinicFeeReportResponse feeReport(long userId, String month) {
        ClinicResponse clinic = clinicService.requirePermission(userId, ClinicPermission.VIEW_CLINIC_REPORTS);
        YearMonth ym = parseMonth(month);
        String start = ym.atDay(1).toString();
        String end = ym.atEndOfMonth().toString();
        String period = ym.toString();

        Map<Long, Acc> inMonth = aggregate(clinic, start, end, null);
        Map<Long, Acc> untilNow = aggregate(clinic, BEGINNING, end, null);
        Map<Long, BigDecimal> paidInMonth = paymentTotals(clinic.id(), period, period);
        Map<Long, BigDecimal> paidUntilNow = paymentTotals(clinic.id(), "0000-00", period);
        Map<Long, List<SharePaymentResponse>> payments = paymentList(clinic.id(), period);

        List<TherapistFee> rows = new ArrayList<>();
        BigDecimal totalOwed = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        BigDecimal totalCumulative = BigDecimal.ZERO;
        String today = LocalDate.now(ZONE).toString();
        String rateDate = today.compareTo(end) < 0 ? today : end;
        for (ClinicMemberResponse member : clinic.members()) {
            if (member.userId() == clinic.ownerUserId()) {
                continue;
            }
            Acc acc = inMonth.get(member.userId());
            BigDecimal owed = money(acc == null ? BigDecimal.ZERO : acc.share);
            BigDecimal paid = money(paidInMonth.getOrDefault(member.userId(), BigDecimal.ZERO));
            BigDecimal remaining = owed.subtract(paid);
            Acc all = untilNow.get(member.userId());
            BigDecimal cumulative = money(
                    (all == null ? BigDecimal.ZERO : all.share).subtract(paidUntilNow.getOrDefault(member.userId(), BigDecimal.ZERO))
            );
            rows.add(new TherapistFee(
                    member.userId(),
                    member.name(),
                    acc == null ? 0 : acc.sessions,
                    commissionService.rateFor(clinic.id(), member.userId(), rateDate),
                    owed,
                    paid,
                    remaining,
                    cumulative,
                    statusOf(owed, paid),
                    payments.getOrDefault(member.userId(), List.of())
            ));
            totalOwed = totalOwed.add(owed);
            totalPaid = totalPaid.add(paid);
            totalCumulative = totalCumulative.add(cumulative);
        }
        rows.sort((a, b) -> b.cumulativeRemaining().compareTo(a.cumulativeRemaining()));
        return new ClinicFeeReportResponse(
                period,
                totalOwed,
                totalPaid,
                totalOwed.subtract(totalPaid),
                totalCumulative,
                rows
        );
    }

    /** Yalnızca çağıran psikologun kendi kazancı ve oda payı durumu. */
    public ClinicReportResponse myEarnings(long userId, String from, String to) {
        ClinicResponse clinic = clinicService.getMine(userId);
        if (clinic == null) {
            return null;
        }
        String start = from == null || from.isBlank() ? monthStart() : ScheduleInputs.requireDate(from);
        String end = to == null || to.isBlank() ? monthEnd() : ScheduleInputs.requireDate(to);
        Map<Long, Acc> byTherapist = aggregate(clinic, start, end, userId);
        Map<Long, BigDecimal> paidByUser = paymentTotals(clinic.id(), start.substring(0, 7), end.substring(0, 7));

        String today = LocalDate.now(ZONE).toString();
        String rateDate = today.compareTo(end) < 0 ? today : end;
        List<TherapistReport> therapists = new ArrayList<>();
        int sessions = 0;
        long paid = 0;
        long pending = 0;
        BigDecimal share = BigDecimal.ZERO;
        BigDecimal sharePaid = BigDecimal.ZERO;
        for (Map.Entry<Long, Acc> entry : byTherapist.entrySet()) {
            long id = entry.getKey();
            Acc acc = entry.getValue();
            BigDecimal rowShare = money(acc.share);
            BigDecimal rowPaid = money(paidByUser.getOrDefault(id, BigDecimal.ZERO));
            BigDecimal percent = id == clinic.ownerUserId()
                    ? BigDecimal.ZERO
                    : commissionService.rateFor(clinic.id(), id, rateDate);
            therapists.add(new TherapistReport(
                    id,
                    acc.name,
                    acc.sessions,
                    acc.paid,
                    acc.pending,
                    rowShare,
                    rowPaid,
                    rowShare.subtract(rowPaid),
                    money(BigDecimal.valueOf(acc.paid).subtract(acc.share)),
                    percent
            ));
            sessions += acc.sessions;
            paid += acc.paid;
            pending += acc.pending;
            share = share.add(rowShare);
            sharePaid = sharePaid.add(rowPaid);
        }
        return new ClinicReportResponse(start, end, sessions, paid, pending, share, sharePaid, share.subtract(sharePaid), therapists);
    }

    /** Odalı, iptal olmayan seansları psikolog bazında toplar. */
    private Map<Long, Acc> aggregate(ClinicResponse clinic, String start, String end, Long onlyUserId) {
        List<Object> args = new ArrayList<>(List.of(clinic.id(), start, end));
        String userFilter = "";
        if (onlyUserId != null) {
            userFilter = " AND c.userId = ?";
            args.add(onlyUserId);
        }
        List<Row> rows = jdbc.query(
                """
                SELECT a.appointmentDate, a.isPaid,
                       COALESCE(a.sessionFee, c.agreedFee, 0) AS amount,
                       c.userId AS therapistId,
                       COALESCE(NULLIF(u.displayName, ''), NULLIF(u.email, ''), u.username) AS therapistName
                FROM appointments a
                INNER JOIN clients c ON c.id = a.clientId
                LEFT JOIN app_users u ON u.id = c.userId
                WHERE a.clinicId = ? AND a.roomId IS NOT NULL
                  AND COALESCE(a.status, 'scheduled') != 'cancelled'
                  AND a.appointmentDate BETWEEN ? AND ?
                """ + userFilter,
                (rs, rowNum) -> new Row(
                        rs.getString("appointmentDate"),
                        rs.getInt("isPaid") == 1,
                        rs.getInt("amount"),
                        rs.getLong("therapistId"),
                        rs.getString("therapistName")
                ),
                args.toArray()
        );

        Map<Long, Acc> byTherapist = new LinkedHashMap<>();
        Map<String, BigDecimal> rateCache = new HashMap<>();
        for (Row row : rows) {
            Acc acc = byTherapist.computeIfAbsent(row.therapistId(), id -> new Acc(row.therapistName()));
            acc.sessions++;
            if (row.paid()) {
                acc.paid += row.amount();
            } else {
                acc.pending += row.amount();
            }
            if (row.therapistId() == clinic.ownerUserId()) {
                continue;
            }
            BigDecimal percent = rateCache.computeIfAbsent(
                    row.therapistId() + "|" + row.date(),
                    key -> commissionService.rateFor(clinic.id(), row.therapistId(), row.date())
            );
            acc.share = acc.share.add(BigDecimal.valueOf(row.amount()).multiply(percent).divide(HUNDRED));
        }
        return byTherapist;
    }

    private Map<Long, BigDecimal> paymentTotals(long clinicId, String fromPeriod, String toPeriod) {
        Map<Long, BigDecimal> totals = new HashMap<>();
        jdbc.query(
                """
                SELECT userId, SUM(amount) AS total FROM clinic_share_payments
                WHERE clinicId = ? AND period BETWEEN ? AND ? GROUP BY userId
                """,
                rs -> {
                    totals.put(rs.getLong("userId"), rs.getBigDecimal("total"));
                },
                clinicId,
                fromPeriod,
                toPeriod
        );
        return totals;
    }

    private Map<Long, List<SharePaymentResponse>> paymentList(long clinicId, String period) {
        Map<Long, List<SharePaymentResponse>> result = new HashMap<>();
        jdbc.query(
                """
                SELECT id, userId, amount, paidOn, note FROM clinic_share_payments
                WHERE clinicId = ? AND period = ? ORDER BY paidOn ASC, id ASC
                """,
                rs -> {
                    result.computeIfAbsent(rs.getLong("userId"), key -> new ArrayList<>()).add(new SharePaymentResponse(
                            rs.getLong("id"),
                            rs.getBigDecimal("amount"),
                            rs.getString("paidOn"),
                            rs.getString("note")
                    ));
                },
                clinicId,
                period
        );
        return result;
    }

    private static String statusOf(BigDecimal owed, BigDecimal paid) {
        if (owed.signum() == 0 && paid.signum() == 0) {
            return "none";
        }
        if (paid.compareTo(owed) >= 0) {
            return "paid";
        }
        return paid.signum() > 0 ? "partial" : "unpaid";
    }

    private static YearMonth parseMonth(String value) {
        if (value == null || value.isBlank()) {
            return YearMonth.now(ZONE);
        }
        try {
            return YearMonth.parse(value.trim());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ay YYYY-AA biçiminde olmalı.");
        }
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String monthStart() {
        return LocalDate.now(ZONE).withDayOfMonth(1).toString();
    }

    private static String monthEnd() {
        LocalDate today = LocalDate.now(ZONE);
        return today.withDayOfMonth(today.lengthOfMonth()).toString();
    }

    private record Row(String date, boolean paid, int amount, long therapistId, String therapistName) {
    }

    private static final class Acc {
        final String name;
        int sessions;
        long paid;
        long pending;
        BigDecimal share = BigDecimal.ZERO;

        Acc(String name) {
            this.name = name;
        }
    }
}
