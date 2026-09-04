package com.testpsikolog.service;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeRequestUrl;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpRequest;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.ConferenceSolutionKey;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventAttendee;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.MeetResponse;
import com.testpsikolog.security.AuthUser;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GoogleCalendarService {

    static final String SIGN_IN_STATE = "signin";
    private static final String TIMEZONE = "Europe/Istanbul";
    private static final List<String> SCOPES = List.of(
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/calendar"
    );

    private final AppProperties appProperties;
    private final JdbcTemplate jdbc;
    private final AuthService authService;

    public GoogleCalendarService(AppProperties appProperties, JdbcTemplate jdbc, AuthService authService) {
        this.appProperties = appProperties;
        this.jdbc = jdbc;
        this.authService = authService;
    }

    public boolean isConnected(long userId) {
        return loadTokens(userId) != null;
    }

    public String getAuthUrl(long userId) {
        return buildAuthUrl(String.valueOf(userId));
    }

    public String getSignInAuthUrl() {
        return buildAuthUrl(SIGN_IN_STATE);
    }

    public String completeOAuth(String code, String state) {
        try {
            NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
            GoogleTokenResponse tokenResponse = requestTokens(transport, code);
            if (SIGN_IN_STATE.equals(state)) {
                String email = fetchGoogleEmail(transport, tokenResponse.getAccessToken());
                var login = authService.loginOrRegisterFromGoogle(email);
                AuthUser user = authService.findByLogin(email);
                if (user == null || user.id() == null) {
                    throw new IllegalStateException("Google oturumu eşleştirilemedi.");
                }
                persistTokens(user.id(), tokenResponse);
                return login.token();
            }
            long userId;
            try {
                userId = Long.parseLong(state);
            } catch (Exception ex) {
                throw new IllegalStateException("Google oturumu eşleştirilemedi.");
            }
            Integer exists = jdbc.query(
                    "SELECT id FROM app_users WHERE id = ?",
                    rs -> rs.next() ? rs.getInt("id") : null,
                    userId
            );
            if (exists == null) {
                throw new IllegalStateException("Google oturumu eşleştirilemedi.");
            }
            persistTokens(userId, tokenResponse);
            return null;
        } catch (GeneralSecurityException | IOException ex) {
            throw new IllegalStateException("Google token exchange error", ex);
        }
    }

    public MeetResponse createCalendarEventWithMeet(long userId, AppointmentResponse appointment, int durationMinutes, String psychologistEmail) {
        try {
            String clientEmail = appointment.clientEmail() == null ? null : appointment.clientEmail().trim();
            if (clientEmail == null || clientEmail.isBlank() || !clientEmail.contains("@")) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Danışanın e-posta adresi yok. Meet daveti için danışan kaydına e-posta ekleyin."
                );
            }
            if (psychologistEmail == null || psychologistEmail.isBlank() || !psychologistEmail.contains("@")) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Google Meet için hesabınızda geçerli bir e-posta olmalı."
                );
            }
            Calendar calendar = calendarClient(userId);
            String clientName = appointment.clientName() == null || appointment.clientName().isBlank()
                    ? "Danışan"
                    : appointment.clientName();
            String title = appointment.title() != null && !appointment.title().isBlank()
                    ? clientName + " - " + appointment.title()
                    : "Randevu - " + clientName;
            DateRange range = toDateTime(appointment.appointmentDate(), appointment.appointmentTime(), durationMinutes);

            ConferenceData conferenceData = new ConferenceData();
            CreateConferenceRequest createRequest = new CreateConferenceRequest();
            createRequest.setRequestId("testpsikolog-" + appointment.id() + "-" + System.currentTimeMillis());
            createRequest.setConferenceSolutionKey(new ConferenceSolutionKey().setType("hangoutsMeet"));
            conferenceData.setCreateRequest(createRequest);

            EventAttendee psychologist = new EventAttendee().setEmail(psychologistEmail).setOrganizer(true).setResponseStatus("accepted");
            EventAttendee client = new EventAttendee().setEmail(clientEmail);
            Event event = new Event()
                    .setSummary(title)
                    .setDescription("Danışan: " + clientName + "\nPsikolog: " + psychologistEmail)
                    .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.startMillis)).setTimeZone(TIMEZONE))
                    .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.endMillis)).setTimeZone(TIMEZONE))
                    .setAttendees(List.of(psychologist, client))
                    .setConferenceData(conferenceData);

            Event created = calendar.events()
                    .insert("primary", event)
                    .setConferenceDataVersion(1)
                    .setSendUpdates("all")
                    .execute();

            String meetLink = null;
            if (created.getConferenceData() != null && created.getConferenceData().getEntryPoints() != null) {
                meetLink = created.getConferenceData().getEntryPoints().stream()
                        .filter(ep -> "video".equals(ep.getEntryPointType()))
                        .map(ep -> ep.getUri())
                        .findFirst()
                        .orElse(null);
            }
            if (meetLink == null) {
                throw new IllegalStateException("Google Meet linki oluşturulamadı.");
            }
            return new MeetResponse(meetLink, created.getId() == null ? "" : created.getId(), created.getHtmlLink() == null ? "" : created.getHtmlLink());
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException(ex.getMessage() == null ? "Google Calendar event create failed" : ex.getMessage(), ex);
        }
    }

    public void updateCalendarEvent(long userId, String eventId, AppointmentResponse appointment, int durationMinutes) {
        try {
            Calendar calendar = calendarClient(userId);
            String clientName = appointment.clientName() == null || appointment.clientName().isBlank()
                    ? "Danışan"
                    : appointment.clientName();
            String title = appointment.title() != null && !appointment.title().isBlank()
                    ? clientName + " - " + appointment.title()
                    : "Randevu - " + clientName;
            DateRange range = toDateTime(appointment.appointmentDate(), appointment.appointmentTime(), durationMinutes);
            Event patch = new Event()
                    .setSummary(title)
                    .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.startMillis)).setTimeZone(TIMEZONE))
                    .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.endMillis)).setTimeZone(TIMEZONE));
            calendar.events().patch("primary", eventId, patch).execute();
        } catch (Exception ex) {
            System.out.println("Google Calendar event update failed: " + ex.getMessage());
        }
    }

    public void deleteCalendarEvent(long userId, String eventId) {
        try {
            calendarClient(userId).events().delete("primary", eventId).execute();
        } catch (Exception ex) {
            System.out.println("Google Calendar event delete failed: " + ex.getMessage());
        }
    }

    private Calendar calendarClient(long userId) throws GeneralSecurityException, IOException {
        JsonObject tokens = loadTokens(userId);
        if (tokens == null || !tokens.has("access_token")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Google hesabı bağlı değil. Gmail ile giriş yapın veya Meet butonundan Google'a bağlanın."
            );
        }
        AppProperties.Google google = appProperties.getGoogle();
        NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
        Credential credential = new Credential.Builder(BearerToken.authorizationHeaderAccessMethod())
                .setTransport(transport)
                .setJsonFactory(GsonFactory.getDefaultInstance())
                .setTokenServerEncodedUrl("https://oauth2.googleapis.com/token")
                .setClientAuthentication(new ClientParametersAuthentication(google.getClientId(), google.getClientSecret()))
                .build();
        credential.setAccessToken(tokens.get("access_token").getAsString());
        if (tokens.has("refresh_token")) {
            credential.setRefreshToken(tokens.get("refresh_token").getAsString());
        }
        if (tokens.has("expiry_date")) {
            credential.setExpirationTimeMilliseconds(tokens.get("expiry_date").getAsLong());
        }
        return new Calendar.Builder(transport, GsonFactory.getDefaultInstance(), credential)
                .setApplicationName("TestPsikolog")
                .build();
    }

    private JsonObject loadTokens(long userId) {
        return jdbc.query(
                "SELECT accessToken, refreshToken, expiryDate FROM google_tokens WHERE userId = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    JsonObject json = new JsonObject();
                    json.addProperty("access_token", rs.getString("accessToken"));
                    String refresh = rs.getString("refreshToken");
                    if (refresh != null) {
                        json.addProperty("refresh_token", refresh);
                    }
                    Object expiry = rs.getObject("expiryDate");
                    if (expiry != null) {
                        json.addProperty("expiry_date", rs.getLong("expiryDate"));
                    }
                    return json;
                },
                userId
        );
    }

    private String buildAuthUrl(String state) {
        AppProperties.Google google = requireGoogleCredentials();
        return new GoogleAuthorizationCodeRequestUrl(
                google.getClientId(),
                google.getRedirectUri(),
                SCOPES
        )
                .setAccessType("offline")
                .set("prompt", "consent")
                .setState(state)
                .build();
    }

    private AppProperties.Google requireGoogleCredentials() {
        AppProperties.Google google = appProperties.getGoogle();
        if (google.getClientId() == null || google.getClientId().isBlank()
                || google.getClientSecret() == null || google.getClientSecret().isBlank()) {
            throw new IllegalStateException("GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET .env dosyasında tanımlı olmalı.");
        }
        return google;
    }

    private GoogleTokenResponse requestTokens(NetHttpTransport transport, String code) throws IOException {
        AppProperties.Google google = requireGoogleCredentials();
        return new GoogleAuthorizationCodeTokenRequest(
                transport,
                GsonFactory.getDefaultInstance(),
                "https://oauth2.googleapis.com/token",
                google.getClientId(),
                google.getClientSecret(),
                code,
                google.getRedirectUri()
        ).execute();
    }

    private void persistTokens(long userId, GoogleTokenResponse tokenResponse) {
        Long expiry = tokenResponse.getExpiresInSeconds() == null
                ? null
                : Instant.now().toEpochMilli() + tokenResponse.getExpiresInSeconds() * 1000;
        jdbc.update(
                """
                INSERT INTO google_tokens (userId, accessToken, refreshToken, expiryDate)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(userId) DO UPDATE SET
                  accessToken = excluded.accessToken,
                  refreshToken = COALESCE(excluded.refreshToken, google_tokens.refreshToken),
                  expiryDate = excluded.expiryDate
                """,
                userId,
                tokenResponse.getAccessToken(),
                tokenResponse.getRefreshToken(),
                expiry
        );
    }

    private String fetchGoogleEmail(NetHttpTransport transport, String accessToken) throws IOException {
        HttpRequest request = transport.createRequestFactory()
                .buildGetRequest(new GenericUrl("https://www.googleapis.com/oauth2/v2/userinfo"));
        request.getHeaders().setAuthorization("Bearer " + accessToken);
        String body = request.execute().parseAsString();
        JsonObject json = JsonParser.parseString(body).getAsJsonObject();
        if (!json.has("email") || json.get("email").isJsonNull() || json.get("email").getAsString().isBlank()) {
            throw new IllegalStateException("Google e-posta alınamadı.");
        }
        return json.get("email").getAsString();
    }

    private DateRange toDateTime(String dateStr, String timeStr, int durationMinutes) {
        String datePart = dateStr != null && dateStr.contains("T") ? dateStr.split("T")[0] : (dateStr == null ? "" : dateStr.substring(0, Math.min(10, dateStr.length())));
        String timePart = (timeStr == null || timeStr.isBlank()) ? "09:00" : timeStr.substring(0, Math.min(5, timeStr.length()));
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
        LocalDateTime startLocal = LocalDateTime.parse(datePart + "T" + timePart + ":00", formatter);
        ZonedDateTime start = startLocal.atZone(ZoneId.of(TIMEZONE));
        ZonedDateTime end = start.plusMinutes(durationMinutes);
        return new DateRange(start.toInstant().toEpochMilli(), end.toInstant().toEpochMilli());
    }

    private record DateRange(long startMillis, long endMillis) {
    }
}
