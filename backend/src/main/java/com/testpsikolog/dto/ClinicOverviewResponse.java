package com.testpsikolog.dto;

import java.util.List;

/**
 * Kliniğin genel durumu. Bilerek hiçbir tutar içermez: kim hangi odada, hangi günlerde,
 * kaç seans yapıyor bilgisi verilir; danışan, ücret ve tahsilat verilmez.
 */
public record ClinicOverviewResponse(
        String from,
        String to,
        int sessions,
        int cancelled,
        int noShow,
        List<TherapistOverview> therapists,
        List<RoomOverview> rooms
) {
    /** @param weekdays Seans yapılan haftanın günleri, 1 = Pazartesi ... 7 = Pazar. */
    public record TherapistOverview(
            long userId,
            String name,
            String role,
            int sessions,
            int cancelled,
            int noShow,
            List<String> rooms,
            List<Integer> weekdays
    ) {
    }

    public record RoomOverview(long roomId, String name, String color, int sessions, int minutes) {
    }
}
