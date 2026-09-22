package com.testpsikolog.util;

import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class ScheduleInputs {

    public static final int DEFAULT_DURATION_MINUTES = 50;

    private static final Pattern TIME_PATTERN = Pattern.compile("^(\\d{1,2}):(\\d{2})(?::\\d{2})?$");

    private ScheduleInputs() {
    }

    public static String requireDate(String value) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir tarih girin.");
        }
        String trimmed = value.trim();
        String datePart = trimmed.contains("T") ? trimmed.split("T")[0] : trimmed;
        try {
            return LocalDate.parse(datePart).toString();
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir tarih girin.");
        }
    }

    public static String requireTime(String value) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir saat girin (SS:DD).");
        }
        Matcher matcher = TIME_PATTERN.matcher(value.trim());
        if (!matcher.matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir saat girin (SS:DD).");
        }
        int hour = Integer.parseInt(matcher.group(1));
        int minute = Integer.parseInt(matcher.group(2));
        if (hour > 23 || minute > 59) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir saat girin (SS:DD).");
        }
        return String.format("%02d:%02d", hour, minute);
    }

    public static int requireDuration(Integer minutes) {
        if (minutes == null) {
            return DEFAULT_DURATION_MINUTES;
        }
        if (minutes < 15 || minutes > 240 || minutes % 5 != 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Seans süresi 15-240 dakika arasında ve 5'in katı olmalı."
            );
        }
        return minutes;
    }

    public static Integer requireNonNegativeFee(Integer fee) {
        if (fee != null && fee < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ücret negatif olamaz.");
        }
        return fee;
    }
}
