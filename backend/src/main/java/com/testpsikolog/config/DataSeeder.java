package com.testpsikolog.config;

import com.testpsikolog.dto.ClinicResponse;
import com.testpsikolog.dto.ClinicRoomResponse;
import com.testpsikolog.dto.CreateAppointmentRequest;
import com.testpsikolog.dto.CreateBlockedSlotRequest;
import com.testpsikolog.dto.CreateClientRequest;
import com.testpsikolog.dto.CreateClinicRequest;
import com.testpsikolog.dto.CreateRoomRequest;
import com.testpsikolog.dto.JoinClinicRequest;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.security.AuthUser;
import com.testpsikolog.service.AppointmentService;
import com.testpsikolog.service.AuthService;
import com.testpsikolog.service.ClientService;
import com.testpsikolog.service.ClinicService;
import com.testpsikolog.service.ScheduleService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@Order(3)
public class DataSeeder implements ApplicationRunner {

    private static final String MOCK_DOMAIN = "@example.test";
    private static final List<String> THERAPIST_NAMES = List.of(
            "Dr. Ayşe Yılmaz",
            "Dr. Mehmet Kaya",
            "Uzm. Psk. Elif Demir",
            "Uzm. Psk. Can Şahin",
            "Psk. Zeynep Arslan",
            "Psk. Burak Çelik"
    );
    private static final List<String> FIRST_NAMES = List.of(
            "Deniz", "Selin", "Emre", "Gizem", "Kerem", "Ece", "Ozan", "İrem",
            "Mert", "Buse", "Cem", "Derya", "Tolga", "Nazlı", "Barış", "Ceren"
    );
    private static final List<String> LAST_NAMES = List.of(
            "Aydın", "Öztürk", "Koç", "Yıldız", "Polat", "Aksoy", "Erdoğan", "Güneş",
            "Kurt", "Özdemir", "Tekin", "Bulut"
    );
    private static final int CLIENTS_PER_THERAPIST = 8;
    private static final int[] SESSION_HOURS = {9, 10, 11, 13, 14, 15, 16, 17};

    private final AuthService authService;
    private final AppProperties appProperties;
    private final ClinicService clinicService;
    private final ClientService clientService;
    private final AppointmentService appointmentService;
    private final ScheduleService scheduleService;

    public DataSeeder(
            AuthService authService,
            AppProperties appProperties,
            ClinicService clinicService,
            ClientService clientService,
            AppointmentService appointmentService,
            ScheduleService scheduleService
    ) {
        this.authService = authService;
        this.appProperties = appProperties;
        this.clinicService = clinicService;
        this.clientService = clientService;
        this.appointmentService = appointmentService;
        this.scheduleService = scheduleService;
    }

    @Override
    public void run(ApplicationArguments args) {
        authService.seedDefaultUser();
        seedMockData();
    }

    private void seedMockData() {
        if (!appProperties.isMockDataEnabled()) {
            return;
        }
        String password = appProperties.getMockPassword() == null ? "" : appProperties.getMockPassword();
        if (password.length() < 6) {
            System.out.println("APP_MOCK_DATA is true but APP_MOCK_PASSWORD is shorter than 6 characters; skipping mock data.");
            return;
        }
        if (authService.findByLogin(therapistEmail(1)) != null) {
            return;
        }
        List<Long> therapists = new ArrayList<>();
        for (int index = 0; index < THERAPIST_NAMES.size(); index++) {
            String email = therapistEmail(index + 1);
            authService.register(new LoginRequest(email, null, password, THERAPIST_NAMES.get(index)));
            AuthUser user = authService.findByLogin(email);
            therapists.add(user.id());
        }

        List<List<Long>> clinicGroups = List.of(
                List.of(therapists.get(0), therapists.get(1), therapists.get(2)),
                List.of(therapists.get(3), therapists.get(4))
        );
        List<String> clinicNames = List.of("Kadıköy Psikoloji Merkezi", "Beşiktaş Terapi Evi");
        List<String> extraRooms = List.of("Oda 2", "");
        List<List<Long>> clinicRooms = new ArrayList<>();
        for (int index = 0; index < clinicGroups.size(); index++) {
            List<Long> members = clinicGroups.get(index);
            long owner = members.get(0);
            ClinicResponse clinic = clinicService.create(owner, new CreateClinicRequest(clinicNames.get(index)));
            if (!extraRooms.get(index).isEmpty()) {
                clinicService.addRoom(owner, clinic.id(), new CreateRoomRequest(extraRooms.get(index), null));
            }
            for (int member = 1; member < members.size(); member++) {
                clinicService.join(members.get(member), new JoinClinicRequest(clinic.inviteCode()));
            }
            clinicRooms.add(clinicService.listRooms(owner, clinic.id()).stream().map(ClinicRoomResponse::id).toList());
        }

        int clientCount = 0;
        int appointmentCount = 0;
        int skipped = 0;
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Istanbul"));
        for (int therapistIndex = 0; therapistIndex < therapists.size(); therapistIndex++) {
            long userId = therapists.get(therapistIndex);
            Random random = new Random(42L + therapistIndex);
            List<Long> clientIds = new ArrayList<>();
            for (int number = 1; number <= CLIENTS_PER_THERAPIST; number++) {
                String name = FIRST_NAMES.get(random.nextInt(FIRST_NAMES.size())) + " "
                        + LAST_NAMES.get(random.nextInt(LAST_NAMES.size()));
                String phone = String.format("0532 %03d %02d %02d", random.nextInt(1000), random.nextInt(100), random.nextInt(100));
                clientIds.add(clientService.create(userId, new CreateClientRequest(
                        "danisan" + (therapistIndex + 1) + "-" + number + MOCK_DOMAIN,
                        name,
                        String.format("%d-%02d-%02d", 1975 + random.nextInt(30), 1 + random.nextInt(12), 1 + random.nextInt(28)),
                        1500 + random.nextInt(8) * 250,
                        null,
                        phone,
                        null,
                        null,
                        null
                )));
                clientCount++;
            }

            List<Long> rooms = null;
            int indexInClinic = -1;
            for (int group = 0; group < clinicGroups.size(); group++) {
                int position = clinicGroups.get(group).indexOf(userId);
                if (position >= 0) {
                    rooms = clinicRooms.get(group);
                    indexInClinic = position;
                }
            }

            for (int dayOffset = -7; dayOffset <= 13; dayOffset++) {
                LocalDate day = today.plusDays(dayOffset);
                if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    continue;
                }
                for (int hour : SESSION_HOURS) {
                    if (random.nextInt(100) >= 40) {
                        continue;
                    }
                    Long roomId = rooms == null
                            ? null
                            : rooms.get(Math.floorMod(indexInClinic + dayOffset + hour, rooms.size()));
                    boolean past = dayOffset < 0;
                    String status = "scheduled";
                    boolean paid = false;
                    if (past) {
                        int roll = random.nextInt(100);
                        status = roll < 80 ? "attended" : roll < 90 ? "no_show" : "cancelled";
                        paid = "attended".equals(status) && random.nextInt(100) < 85;
                    }
                    try {
                        appointmentService.create(userId, clientIds.get(random.nextInt(clientIds.size())), new CreateAppointmentRequest(
                                day.toString(),
                                String.format("%02d:00", hour),
                                null,
                                paid,
                                status,
                                roomId,
                                50,
                                null
                        ));
                        appointmentCount++;
                    } catch (ResponseStatusException ex) {
                        skipped++;
                    }
                }
            }

            LocalDate nextWorkday = today.plusDays(1);
            while (nextWorkday.getDayOfWeek() == DayOfWeek.SATURDAY || nextWorkday.getDayOfWeek() == DayOfWeek.SUNDAY) {
                nextWorkday = nextWorkday.plusDays(1);
            }
            scheduleService.create(userId, new CreateBlockedSlotRequest(nextWorkday.toString(), "12:00", "13:00", "Öğle arası"));
        }
        System.out.println("Mock data created: " + therapists.size() + " therapists, " + clientCount
                + " clients, " + appointmentCount + " appointments, " + skipped + " skipped.");
    }

    private static String therapistEmail(int number) {
        return "psikolog" + number + MOCK_DOMAIN;
    }
}
