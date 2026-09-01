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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class AppointmentController {

    private final AppointmentService appointmentService;
    private final NoteService noteService;
    private final GoogleCalendarService googleCalendarService;

    public AppointmentController(
            AppointmentService appointmentService,
            NoteService noteService,
            GoogleCalendarService googleCalendarService
    ) {
        this.appointmentService = appointmentService;
        this.noteService = noteService;
        this.googleCalendarService = googleCalendarService;
    }

    @GetMapping("/appointments")
    public List<AppointmentResponse> getAllAppointments() {
        return appointmentService.getAll();
    }

    @GetMapping("/appointments/{id}")
    public AppointmentResponse getAppointment(@PathVariable long id) {
        AppointmentResponse appointment = appointmentService.getByIdWithClient(id);
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
        AppointmentResponse appointment = appointmentService.getByIdWithClient(appointmentId);
        if (appointment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Randevu bulunamadı.");
        }
        int duration = body != null && body.durationMinutes() != null ? body.durationMinutes() : 60;
        MeetResponse result = googleCalendarService.createCalendarEventWithMeet(appointment, duration);
        appointmentService.updateGoogleFields(appointmentId, result.eventId(), result.meetLink(), result.htmlLink());
        return result;
    }

    @GetMapping("/clients/{clientId}/appointments")
    public List<AppointmentResponse> getClientAppointments(@PathVariable long clientId) {
        return appointmentService.getByClientId(clientId);
    }

    @PostMapping("/clients/{clientId}/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateAppointmentResponse createAppointment(
            @PathVariable long clientId,
            @RequestBody CreateAppointmentRequest body
    ) {
        long id = appointmentService.create(clientId, body);
        String googleMeetLink = null;
        String googleHtmlLink = null;
        if (googleCalendarService.isConnected()) {
            try {
                AppointmentResponse appointment = appointmentService.getByIdWithClient(id);
                if (appointment != null) {
                    MeetResponse result = googleCalendarService.createCalendarEventWithMeet(appointment, 60);
                    appointmentService.updateGoogleFields(id, result.eventId(), result.meetLink(), result.htmlLink());
                    googleMeetLink = result.meetLink();
                    googleHtmlLink = result.htmlLink();
                }
            } catch (Exception googleErr) {
                System.out.println("Google Calendar event create failed: " + googleErr.getMessage());
            }
        }
        return new CreateAppointmentResponse(id, googleMeetLink, googleHtmlLink);
    }

    @PutMapping("/clients/{clientId}/appointments/{appointmentId}")
    public UpdatedResponse updateAppointment(
            @PathVariable long clientId,
            @PathVariable long appointmentId,
            @RequestBody UpdateAppointmentRequest body
    ) {
        int updated = appointmentService.update(appointmentId, clientId, body);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found");
        }
        AppointmentResponse appointment = appointmentService.getByIdWithClient(appointmentId);
        if (appointment != null
                && appointment.googleEventId() != null
                && (body.appointmentDate() != null || body.appointmentTime() != null || body.title() != null)) {
            googleCalendarService.updateCalendarEvent(appointment.googleEventId(), appointment, 60);
        }
        return new UpdatedResponse(updated);
    }

    @DeleteMapping("/clients/{clientId}/appointments/{appointmentId}")
    public DeletedResponse deleteAppointment(@PathVariable long clientId, @PathVariable long appointmentId) {
        AppointmentResponse appointment = appointmentService.getByIdWithClient(appointmentId);
        if (appointment != null && appointment.googleEventId() != null) {
            googleCalendarService.deleteCalendarEvent(appointment.googleEventId());
        }
        int deleted = appointmentService.delete(appointmentId, clientId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found");
        }
        return new DeletedResponse(deleted);
    }

    @GetMapping("/clients/{clientId}/appointments/{appointmentId}/notes")
    public List<NoteResponse> getAppointmentNotes(@PathVariable long appointmentId) {
        return noteService.getByAppointmentId(appointmentId);
    }

    @PostMapping("/clients/{clientId}/appointments/{appointmentId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public IdResponse createAppointmentNote(
            @PathVariable long clientId,
            @PathVariable long appointmentId,
            @RequestBody CreateNoteRequest body
    ) {
        CreateNoteRequest merged = new CreateNoteRequest(
                clientId,
                appointmentId,
                body.title(),
                body.content(),
                body.noteDate()
        );
        return new IdResponse(noteService.create(merged));
    }
}
