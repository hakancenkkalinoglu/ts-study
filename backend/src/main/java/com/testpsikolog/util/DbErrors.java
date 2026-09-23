package com.testpsikolog.util;

import java.sql.SQLException;

public final class DbErrors {

    private static final String UNIQUE_VIOLATION = "23505";
    private static final String EXCLUSION_VIOLATION = "23P01";
    private static final String SERIALIZATION_FAILURE = "40001";
    private static final String DEADLOCK_DETECTED = "40P01";
    private static final String LOCK_NOT_AVAILABLE = "55P03";
    private static final String QUERY_CANCELED = "57014";

    private DbErrors() {
    }

    public static boolean isUniqueViolation(Throwable error) {
        return hasSqlState(error, UNIQUE_VIOLATION);
    }

    public static boolean isOverlapViolation(Throwable error) {
        return hasSqlState(error, EXCLUSION_VIOLATION);
    }

    public static String overlapMessage(Throwable error) {
        String message = sqlMessage(error);
        if (message.contains("ex_appointments_room_slot")) {
            return "Bu oda bu saat aralığında dolu.";
        }
        if (message.contains("ex_blocked_slots_user_slot")) {
            return "Bu saat aralığı dolu veya kapalı.";
        }
        return "Bu saat aralığında zaten bir randevunuz var.";
    }

    public static boolean isBusy(Throwable error) {
        return hasSqlState(error, SERIALIZATION_FAILURE, DEADLOCK_DETECTED, LOCK_NOT_AVAILABLE, QUERY_CANCELED);
    }

    private static boolean hasSqlState(Throwable error, String... states) {
        String state = sqlState(error);
        if (state == null) {
            return false;
        }
        for (String expected : states) {
            if (expected.equals(state)) {
                return true;
            }
        }
        return false;
    }

    private static String sqlState(Throwable error) {
        SQLException sql = findSqlException(error);
        return sql == null ? null : sql.getSQLState();
    }

    private static String sqlMessage(Throwable error) {
        SQLException sql = findSqlException(error);
        return sql == null || sql.getMessage() == null ? "" : sql.getMessage();
    }

    private static SQLException findSqlException(Throwable error) {
        Throwable current = error;
        int depth = 0;
        while (current != null && depth < 10) {
            if (current instanceof SQLException sql && sql.getSQLState() != null) {
                return sql;
            }
            current = current.getCause();
            depth++;
        }
        return null;
    }
}
