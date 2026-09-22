package com.testpsikolog.service;

import com.testpsikolog.dto.CreateNoteRequest;
import com.testpsikolog.dto.NoteResponse;
import com.testpsikolog.dto.UpdateNoteRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NoteService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "png", "jpg", "jpeg", "webp", "txt", "doc", "docx");
    private static final long MAX_BYTES = 8L * 1024 * 1024;
    private static final int MAX_CONTENT_LENGTH = 50_000;
    private static final int MAX_TITLE_LENGTH = 200;

    private static final RowMapper<NoteResponse> NOTE_MAPPER = (rs, rowNum) -> new NoteResponse(
            rs.getLong("id"),
            rs.getLong("clientId"),
            rs.getObject("appointmentId") == null ? null : rs.getLong("appointmentId"),
            rs.getString("title"),
            rs.getString("content"),
            rs.getString("fileName"),
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
        if (note.content() == null || note.content().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not içeriği boş olamaz.");
        }
        assertLengths(note.title(), note.content());
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
                note.content().trim(),
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
        assertLengths(data.title(), data.content());
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
        deleteStoredFile(userId, noteId);
        return jdbc.update(
                "DELETE FROM client_notes WHERE id = ? AND clientId = ?",
                noteId,
                clientId
        );
    }

    public NoteResponse attachFile(long userId, long clientId, long noteId, MultipartFile file) {
        requireOwnedNote(userId, clientId, noteId);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dosya seçin.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dosya en fazla 8 MB olabilir.");
        }
        String original = file.getOriginalFilename() == null ? "ek" : file.getOriginalFilename();
        String safeName = sanitizeFileName(original);
        String ext = extensionOf(safeName);
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bu dosya türüne izin yok.");
        }
        try {
            Path dir = uploadDir(userId);
            Files.createDirectories(dir);
            deleteStoredFile(userId, noteId);
            Path target = dir.resolve(noteId + "_" + safeName);
            Files.copy(file.getInputStream(), target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            jdbc.update(
                    """
                    UPDATE client_notes
                    SET filePath = ?, fileName = ?, updatedAt = datetime('now')
                    WHERE id = ? AND clientId = ?
                    """,
                    target.toString(),
                    safeName,
                    noteId,
                    clientId
            );
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Dosya kaydedilemedi.");
        }
        return getByClientId(userId, clientId).stream()
                .filter(note -> note.id() == noteId)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not bulunamadı."));
    }

    public Path loadFile(long userId, long clientId, long noteId) {
        requireOwnedNote(userId, clientId, noteId);
        String stored = jdbc.query(
                "SELECT filePath FROM client_notes WHERE id = ? AND clientId = ?",
                rs -> rs.next() ? rs.getString("filePath") : null,
                noteId,
                clientId
        );
        if (stored == null || stored.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bu notta ek yok.");
        }
        Path path = Path.of(stored);
        if (!Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ek dosyası bulunamadı.");
        }
        return path;
    }

    public String fileNameOf(long userId, long clientId, long noteId) {
        requireOwnedNote(userId, clientId, noteId);
        String name = jdbc.query(
                "SELECT fileName FROM client_notes WHERE id = ? AND clientId = ?",
                rs -> rs.next() ? rs.getString("fileName") : null,
                noteId,
                clientId
        );
        return name == null || name.isBlank() ? "ek" : name;
    }

    public void removeFile(long userId, long clientId, long noteId) {
        requireOwnedNote(userId, clientId, noteId);
        deleteStoredFile(userId, noteId);
        jdbc.update(
                "UPDATE client_notes SET filePath = NULL, fileName = NULL, updatedAt = datetime('now') WHERE id = ? AND clientId = ?",
                noteId,
                clientId
        );
    }

    private void deleteStoredFile(long userId, long noteId) {
        String stored = jdbc.query(
                "SELECT filePath FROM client_notes WHERE id = ?",
                rs -> rs.next() ? rs.getString("filePath") : null,
                noteId
        );
        if (stored == null || stored.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(stored));
        } catch (IOException ex) {
            System.out.println("Note attachment delete failed: " + ex.getMessage());
        }
    }

    private static void assertLengths(String title, String content) {
        if (title != null && title.length() > MAX_TITLE_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not başlığı en fazla 200 karakter olabilir.");
        }
        if (content != null && content.length() > MAX_CONTENT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not içeriği en fazla 50.000 karakter olabilir.");
        }
    }

    private static Path uploadDir(long userId) {
        return Path.of(System.getProperty("user.dir"), "data", "uploads", String.valueOf(userId));
    }

    private static String sanitizeFileName(String original) {
        String name = Path.of(original).getFileName().toString();
        name = name.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (name.isBlank()) {
            return "ek";
        }
        if (name.length() > 80) {
            return name.substring(name.length() - 80);
        }
        return name;
    }

    private static String extensionOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
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
