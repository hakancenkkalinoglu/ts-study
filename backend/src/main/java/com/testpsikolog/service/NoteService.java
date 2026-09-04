package com.testpsikolog.service;

import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.NoteResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NoteService {

    private static final RowMapper<NoteResponse> NOTE_MAPPER = (rs, rowNum) -> new NoteResponse(
            rs.getLong("id"),
            rs.getLong("clientId"),
            rs.getObject("appointmentId") == null ? null : rs.getLong("appointmentId"),
            rs.getString("title"),
            rs.getString("content"),
            rs.getString("filePath"),
            rs.getString("noteDate"),
            rs.getString("createdAt"),
            rs.getString("updatedAt")
    );

    private final JdbcTemplate jdbc;
    private final ClientService clientService;
    private final AppointmentService appointmentService;

    public NoteService(JdbcTemplate jdbc, ClientService clientService, AppointmentService appointmentService) {
        this.jdbc = jdbc;
        this.clientService = clientService;
        this.appointmentService = appointmentService;
    }

    public long create(long userId, CreateNoteRequest note) {
        clientService.requireOwned(userId, note.clientId());
        if (note.appointmentId() != null) {
            var appointment = appointmentService.getByIdWithClient(userId, note.appointmentId());
            if (appointment == null || appointment.clientId() != note.clientId()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Randevu bulunamadı.");
            }
        }
        jdbc.update(
                """
                INSERT INTO client_notes (clientId, appointmentId, title, content, noteDate, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """,
                note.clientId(),
                note.appointmentId(),
                note.title(),
                note.content(),
                note.noteDate()
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        return id == null ? 0L : id;
    }

    public List<NoteResponse> getByClientId(long userId, long clientId) {
        clientService.requireOwned(userId, clientId);
        return jdbc.query(
                "SELECT * FROM client_notes WHERE clientId = ? ORDER BY noteDate DESC, createdAt DESC",
                NOTE_MAPPER,
                clientId
        );
    }

    public List<NoteResponse> getByAppointmentId(long userId, long clientId, long appointmentId) {
        clientService.requireOwned(userId, clientId);
        var appointment = appointmentService.getByIdWithClient(userId, appointmentId);
        if (appointment == null || appointment.clientId() != clientId) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Randevu bulunamadı.");
        }
        return jdbc.query(
                "SELECT * FROM client_notes WHERE appointmentId = ? ORDER BY noteDate DESC, createdAt DESC",
                NOTE_MAPPER,
                appointmentId
        );
    }
}
