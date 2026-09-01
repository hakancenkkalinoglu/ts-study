package com.testpsikolog.service;

import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.NoteResponse;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

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

    public NoteService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long create(CreateNoteRequest note) {
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

    public List<NoteResponse> getByClientId(long clientId) {
        return jdbc.query(
                "SELECT * FROM client_notes WHERE clientId = ? ORDER BY noteDate DESC, createdAt DESC",
                NOTE_MAPPER,
                clientId
        );
    }

    public List<NoteResponse> getByAppointmentId(long appointmentId) {
        return jdbc.query(
                "SELECT * FROM client_notes WHERE appointmentId = ? ORDER BY noteDate DESC, createdAt DESC",
                NOTE_MAPPER,
                appointmentId
        );
    }
}
