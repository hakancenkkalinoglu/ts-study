package com.testpsikolog.controller;

import com.testpsikolog.dto.AppointmentResponse;
import com.testpsikolog.dto.CreateAppointmentRequest;
import com.testpsikolog.dto.CreateAppointmentResponse;
import com.testpsikolog.dto.CreateMeetRequest;
import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.DeletedResponse;
import com.testpsikolog.dto.IdResponse;
import com.testpsikolog.dto.MeetResponse;
import com.testpsikolog.dto.NoteResponse;
import com.testpsikolog.dto.UpdateAppointmentRequest;
import com.testpsikolog.dto.UpdatedResponse;
import com.testpsikolog.service.AppointmentService;
import com.testpsikolog.service.AuthService;
import com.testpsikolog.service.CurrentUserService;
import com.testpsikolog.service.GoogleCalendarService;
import com.testpsikolog.service.NoteService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final NoteService noteService;
    private final GoogleCalendarService googleCalendarService;
    private final CurrentUserService currentUserService;
    private final AuthService authService;

    public AppointmentController(
            AppointmentService appointmentService,
            NoteService noteService,
            GoogleCalendarService googleCalendarService,
            CurrentUserService currentUserService,
            AuthService authService
    ) {
        this.appointmentService = appointmentService;
        this.noteService = noteService;
        this.googleCalendarService = googleCalendarService;
        this.currentUserService = currentUserService;
        this.authService = authService;
    }

    @GetMapping("/appointments/upcoming")
    public List<AppointmentResponse> getUpcoming(@RequestParam(value = "hours", required = false) Integer hours) {
        long userId = currentUserService.requireUser().id();
        int window = hours == null ? 24 : hours;
        return appointmentService.getUpcoming(userId, window);
    }

    @GetMapping("/appointments")
    public List<AppointmentResponse> getAllAppointments(@RequestParam(value = "scope", required = false) String scope) {
        long userId = currentUserService.requireUser().id();
        return appointmentService.getAll(userId, scope);
    }

    @GetMapping("/appointments/{id}")
    public AppointmentResponse getAppointment(@PathVariable long id) {
        long userId = currentUserService.requireUser().id();
        AppointmentResponse appointment = appointmentService.getByIdWithClient(userId, id);
        if (appointment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Randevu bulunamadı.");
        }
        return appointment;
    }

    @PostMapping("/appointments/{appointmentId}/create-meet")
    public MeetResponse createMeet(
            @PathVariable long appointmentId,
            @RequestBody(required = false) CreateMeetRequest body
    ) {
        long userId = currentUserService.requireUser().id();
        AppointmentResponse appointment = appointmentService.getByIdWithClient(userId, appointmentId);
        if (appointment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Randevu bulunamadı.");
        }
        int duration = body != null && body.durationMinutes() != null
                ? body.durationMinutes()
                : appointment.durationMinutes();
        String psychologistEmail = authService.requireEmail(userId);
        MeetResponse result = googleCalendarService.createCalendarEventWithMeet(userId, appointment, duration, psychologistEmail);
        appointmentService.updateGoogleFields(userId, appointmentId, result.eventId(), result.meetLink(), result.htmlLink());
        return result;
    }

    @GetMapping("/clients/{clientId}/appointments")
    public List<AppointmentResponse> getClientAppointments(@PathVariable long clientId) {
        long userId = currentUserService.requireUser().id();
        return appointmentService.getByClientId(userId, clientId);
    }

    @PostMapping("/clients/{clientId}/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateAppointmentResponse createAppointment(
            @PathVariable long clientId,
            @RequestBody CreateAppointmentRequest body
    ) {
        long userId = currentUserService.requireUser().id();
        List<Long> ids = appointmentService.create(userId, clientId, body);
        long id = ids.isEmpty() ? 0L : ids.get(0);
        String googleMeetLink = null;
        String googleHtmlLink = null;
        if (googleCalendarService.isConnected(userId)) {
            for (Long createdId : ids) {
                try {
                    AppointmentResponse appointment = appointmentService.getByIdWithClient(userId, createdId);
                    if (appointment == null) {
                        continue;
                    }
                    MeetResponse result = googleCalendarService.createCalendarEventWithMeet(
                            userId,
                            appointment,
                            appointment.durationMinutes(),
                            authService.requireEmail(userId)
                    );
                    appointmentService.updateGoogleFields(
                            userId,
                            createdId,
                            result.eventId(),
                            result.meetLink(),
                            result.htmlLink()
                    );
                    if (createdId == id) {
                        googleMeetLink = result.meetLink();
                        googleHtmlLink = result.htmlLink();
                    }
                } catch (Exception googleErr) {
                    System.out.println("Google Calendar event create failed: " + googleErr.getMessage());
                }
            }
        }
        return new CreateAppointmentResponse(id, ids.size(), googleMeetLink, googleHtmlLink);
    }

    @PutMapping("/clients/{clientId}/appointments/{appointmentId}")
    public UpdatedResponse updateAppointment(
            @PathVariable long clientId,
            @PathVariable long appointmentId,
            @RequestBody UpdateAppointmentRequest body
    ) {
        long userId = currentUserService.requireUser().id();
        int updated = appointmentService.update(userId, appointmentId, clientId, body);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found");
        }
        AppointmentResponse appointment = appointmentService.getByIdWithClient(userId, appointmentId);
        if (appointment != null && appointment.googleEventId() != null && "cancelled".equals(appointment.status())) {
            googleCalendarService.deleteCalendarEvent(userId, appointment.googleEventId());
            appointmentService.updateGoogleFields(userId, appointmentId, null, null, null);
        } else if (appointment != null
                && appointment.googleEventId() != null
                && (body.appointmentDate() != null
                        || body.appointmentTime() != null
                        || body.title() != null
                        || body.durationMinutes() != null)) {
            googleCalendarService.updateCalendarEvent(
                    userId,
                    appointment.googleEventId(),
                    appointment,
                    appointment.durationMinutes()
            );
        }
        return new UpdatedResponse(updated);
    }

    @DeleteMapping("/clients/{clientId}/appointments/{appointmentId}")
    public DeletedResponse deleteAppointment(@PathVariable long clientId, @PathVariable long appointmentId) {
        long userId = currentUserService.requireUser().id();
        AppointmentResponse appointment = appointmentService.getByIdWithClient(userId, appointmentId);
        if (appointment != null && appointment.googleEventId() != null) {
            googleCalendarService.deleteCalendarEvent(userId, appointment.googleEventId());
        }
        int deleted = appointmentService.delete(userId, appointmentId, clientId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found");
        }
        return new DeletedResponse(deleted);
    }

    @GetMapping("/clients/{clientId}/appointments/{appointmentId}/notes")
    public List<NoteResponse> getAppointmentNotes(@PathVariable long clientId, @PathVariable long appointmentId) {
        long userId = currentUserService.requireUser().id();
        return noteService.getByAppointmentId(userId, clientId, appointmentId);
    }

    @PostMapping("/clients/{clientId}/appointments/{appointmentId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse createAppointmentNote(
            @PathVariable long clientId,
            @PathVariable long appointmentId,
            @RequestBody CreateNoteRequest body
    ) {
        long userId = currentUserService.requireUser().id();
        CreateNoteRequest merged = new CreateNoteRequest(
                clientId,
                appointmentId,
                body.title(),
                body.content(),
                body.noteDate()
        );
        return new IdResponse(noteService.create(userId, merged));
    }
}
