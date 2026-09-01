package com.testpsikolog.service;

import com.google.api.client.auth.oauth2.BearerToken;
import com.google.api.client.auth.oauth2.ClientParametersAuthentication;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeRequestUrl;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.ConferenceData;
import com.google.api.services.calendar.model.ConferenceSolutionKey;
import com.google.api.services.calendar.model.CreateConferenceRequest;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.MeetResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GoogleCalendarService {

    private static final String SCOPE = "https://www.googleapis.com/auth/calendar";
    private static final String TIMEZONE = "Europe/Istanbul";
    private static final Gson GSON = new Gson();

    private final AppProperties appProperties;

    public GoogleCalendarService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    public boolean isConnected() {
        return loadTokens() != null;
    }

    public String getAuthUrl() {
        AppProperties.Google google = appProperties.getGoogle();
        if (google.getClientId() == null || google.getClientId().isBlank()
                || google.getClientSecret() == null || google.getClientSecret().isBlank()) {
            throw new IllegalStateException("GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET .env dosyasında tanımlı olmalı.");
        }
        return new GoogleAuthorizationCodeRequestUrl(
                google.getClientId(),
                google.getRedirectUri(),
                List.of(SCOPE)
        )
                .setAccessType("offline")
                .set("prompt", "consent")
                .build();
    }

    public void exchangeCode(String code) {
        AppProperties.Google google = appProperties.getGoogle();
        try {
            NetHttpTransport transport = GoogleNetHttpTransport.newTrustedTransport();
            GoogleTokenResponse tokenResponse = new GoogleAuthorizationCodeTokenRequest(
                    transport,
                    GsonFactory.getDefaultInstance(),
                    "https://oauth2.googleapis.com/token",
                    google.getClientId(),
                    google.getClientSecret(),
                    code,
                    google.getRedirectUri()
            ).execute();
            JsonObject json = new JsonObject();
            if (tokenResponse.getAccessToken() != null) {
                json.addProperty("access_token", tokenResponse.getAccessToken());
            }
            if (tokenResponse.getRefreshToken() != null) {
                json.addProperty("refresh_token", tokenResponse.getRefreshToken());
            }
            if (tokenResponse.getExpiresInSeconds() != null) {
                json.addProperty("expiry_date", Instant.now().toEpochMilli() + tokenResponse.getExpiresInSeconds() * 1000);
            }
            Path path = Path.of(google.getTokensPath());
            Files.createDirectories(path.getParent());
            Files.writeString(path, GSON.toJson(json), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IOException ex) {
            throw new IllegalStateException("Google token exchange error", ex);
        }
    }

    public MeetResponse createCalendarEventWithMeet(AppointmentResponse appointment, int durationMinutes) {
        try {
            Calendar calendar = calendarClient();
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

            Event event = new Event()
                    .setSummary(title)
                    .setDescription(appointment.clientName() != null ? "Danışan: " + appointment.clientName() : null)
                    .setStart(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.startMillis)).setTimeZone(TIMEZONE))
                    .setEnd(new EventDateTime().setDateTime(new com.google.api.client.util.DateTime(range.endMillis)).setTimeZone(TIMEZONE))
                    .setConferenceData(conferenceData);

            Event created = calendar.events()
                    .insert("primary", event)
                    .setConferenceDataVersion(1)
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

    public void updateCalendarEvent(String eventId, AppointmentResponse appointment, int durationMinutes) {
        try {
            Calendar calendar = calendarClient();
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

    public void deleteCalendarEvent(String eventId) {
        try {
            calendarClient().events().delete("primary", eventId).execute();
        } catch (Exception ex) {
            System.out.println("Google Calendar event delete failed: " + ex.getMessage());
        }
    }

    private Calendar calendarClient() throws GeneralSecurityException, IOException {
        JsonObject tokens = loadTokens();
        if (tokens == null || !tokens.has("access_token")) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Google Calendar bağlı değil. Önce \"Google ile bağlan\" ile yetkilendirme yapın."
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

    private JsonObject loadTokens() {
        try {
            Path path = Path.of(appProperties.getGoogle().getTokensPath());
            if (!Files.exists(path)) {
                return null;
            }
            String raw = Files.readString(path, StandardCharsets.UTF_8);
            return GSON.fromJson(raw, JsonObject.class);
        } catch (Exception ex) {
            return null;
        }
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
