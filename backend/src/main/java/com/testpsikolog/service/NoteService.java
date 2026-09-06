package com.testpsikolog.service;

import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.NoteResponse;
import com.testpsikolog.dto.UpdateNoteRequest;
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

    public int update(long userId, long clientId, long noteId, UpdateNoteRequest data) {
        requireOwnedNote(userId, clientId, noteId);
        if (data.content() != null && data.content().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not içeriği boş olamaz.");
        }
        return jdbc.update(
                """
                UPDATE client_notes
                SET
                  title = COALESCE(?, title),
                  content = COALESCE(?, content),
                  noteDate = COALESCE(?, noteDate),
                  updatedAt = datetime('now')
                WHERE id = ? AND clientId = ?
                """,
                data.title(),
                data.content() == null ? null : data.content().trim(),
                data.noteDate(),
                noteId,
                clientId
        );
    }

    public int delete(long userId, long clientId, long noteId) {
        requireOwnedNote(userId, clientId, noteId);
        return jdbc.update(
                "DELETE FROM client_notes WHERE id = ? AND clientId = ?",
                noteId,
                clientId
        );
    }

    private void requireOwnedNote(long userId, long clientId, long noteId) {
        clientService.requireOwned(userId, clientId);
        Integer exists = jdbc.query(
                """
                SELECT n.id FROM client_notes n
                INNER JOIN clients c ON n.clientId = c.id
                WHERE n.id = ? AND n.clientId = ? AND c.userId = ?
                """,
                rs -> rs.next() ? rs.getInt("id") : null,
                noteId,
                clientId,
                userId
        );
        if (exists == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not bulunamadı.");
        }
    }
}
