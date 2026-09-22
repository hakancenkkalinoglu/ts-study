package com.testpsikolog.service;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.security.AuthUser;
import com.testpsikolog.security.JwtService;
import com.testpsikolog.security.LoginThrottle;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final String LOGIN_THROTTLE_PREFIX = "login:";
    private static final String RESET_THROTTLE_PREFIX = "reset:";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties appProperties;
    private final ClientService clientService;
    private final LoginThrottle loginThrottle;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AppProperties appProperties,
            ClientService clientService,
            LoginThrottle loginThrottle
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.appProperties = appProperties;
        this.clientService = clientService;
        this.loginThrottle = loginThrottle;
    }

    public LoginResponse login(LoginRequest request) {
        validatePassword(request);
        String loginId = request.loginId();
        if (loginId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta gerekli.");
        }
        String throttleKey = LOGIN_THROTTLE_PREFIX + loginId;
        loginThrottle.assertAllowed(throttleKey);
        AuthUser user = findByLogin(loginId);
        if (user == null || user.id() == null) {
            loginThrottle.recordFailure(throttleKey);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-posta veya şifre hatalı.");
        }
        String hash = jdbc.query(
                "SELECT passwordHash FROM app_users WHERE id = ?",
                rs -> rs.next() ? rs.getString("passwordHash") : null,
                user.id()
        );
        if (hash == null || !passwordEncoder.matches(request.password(), hash)) {
            loginThrottle.recordFailure(throttleKey);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-posta veya şifre hatalı.");
        }
        loginThrottle.reset(throttleKey);
        return toResponse(user);
    }

    public LoginResponse register(LoginRequest request) {
        validatePassword(request);
        String email = request.loginId();
        if (email == null || !email.contains("@") || email.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir e-posta girin.");
        }
        email = email.toLowerCase();
        if (request.password().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Şifre en az 6 karakter olmalı.");
        }
        if (findByLogin(email) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu e-posta ile kayıtlı bir hesap var.");
        }
        String displayName = request.displayName() == null || request.displayName().isBlank()
                ? email
                : request.displayName().trim();
        if (displayName.length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Görünen ad en fazla 80 karakter olabilir.");
        }
        String hash = passwordEncoder.encode(request.password());
        jdbc.update(
                "INSERT INTO app_users (username, email, passwordHash, displayName, reminderHours) VALUES (?, ?, ?, ?, 24)",
                email,
                email,
                hash,
                displayName
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Kayıt oluşturulamadı.");
        }
        return toResponse(new AuthUser(id, email, email));
    }

    public LoginResponse loginOrRegisterFromGoogle(String googleEmail) {
        if (googleEmail == null || !googleEmail.contains("@") || googleEmail.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google e-posta alınamadı.");
        }
        String email = googleEmail.trim().toLowerCase();
        AuthUser existing = findByLogin(email);
        if (existing != null && existing.id() != null) {
            return toResponse(existing);
        }
        String hash = passwordEncoder.encode(UUID.randomUUID().toString());
        jdbc.update(
                "INSERT INTO app_users (username, email, passwordHash, displayName, reminderHours) VALUES (?, ?, ?, ?, 24)",
                email,
                email,
                hash,
                email
        );
        Long id = jdbc.queryForObject("SELECT last_insert_rowid()", Long.class);
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Kayıt oluşturulamadı.");
        }
        return toResponse(new AuthUser(id, email, email));
    }

    public String requireEmail(long userId) {
        String email = jdbc.query(
                "SELECT email FROM app_users WHERE id = ?",
                rs -> rs.next() ? rs.getString("email") : null,
                userId
        );
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Google Meet için hesabınızda geçerli bir e-posta olmalı."
            );
        }
        return email.trim();
    }

    public AuthUser authenticate(String token) {
        AuthUser parsed = jwtService.parse(token);
        AuthUser user = parsed.id() != null ? findById(parsed.id()) : findByLogin(parsed.username());
        if (user == null || user.id() == null) {
            throw new IllegalArgumentException("Token gecersiz.");
        }
        if (jwtService.tokenVersion(token) != currentTokenVersion(user.id())) {
            throw new IllegalArgumentException("Token revoked.");
        }
        return user;
    }

    public AuthUser findByLogin(String loginId) {
        return jdbc.query(
                "SELECT id, username, email FROM app_users WHERE email = ? OR username = ?",
                rs -> rs.next() ? mapUser(rs) : null,
                loginId,
                loginId
        );
    }

    public AuthUser findById(long id) {
        return jdbc.query(
                "SELECT id, username, email FROM app_users WHERE id = ?",
                rs -> rs.next() ? mapUser(rs) : null,
                id
        );
    }

    public void seedDefaultUser() {
        if (!appProperties.isSeedEnabled()) {
            return;
        }
        String username = appProperties.getSeedUsername() == null ? "" : appProperties.getSeedUsername().trim();
        String password = appProperties.getSeedPassword() == null ? "" : appProperties.getSeedPassword();
        if (username.isBlank() || password.isBlank()) {
            System.out.println("APP_SEED_ENABLED is true but username or password is empty; skipping seed user.");
            return;
        }
        Integer existing = jdbc.query(
                "SELECT id FROM app_users WHERE username = ?",
                rs -> rs.next() ? rs.getInt("id") : null,
                username
        );
        if (existing != null) {
            return;
        }
        String hash = passwordEncoder.encode(password);
        jdbc.update(
                "INSERT INTO app_users (username, passwordHash) VALUES (?, ?)",
                username,
                hash
        );
        System.out.println("Seed login user created.");
    }

    public String createLoginExchange(String token) {
        String code = UUID.randomUUID().toString().replace("-", "");
        long expiresAt = Instant.now().plusSeconds(120).toEpochMilli();
        jdbc.update(
                "INSERT INTO auth_exchange_codes (code, token, expiresAt) VALUES (?, ?, ?)",
                code,
                token,
                expiresAt
        );
        return code;
    }

    public LoginResponse consumeLoginExchange(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş kodu geçersiz.");
        }
        jdbc.update("DELETE FROM auth_exchange_codes WHERE expiresAt < ?", Instant.now().toEpochMilli());
        String token = jdbc.query(
                "SELECT token FROM auth_exchange_codes WHERE code = ?",
                rs -> rs.next() ? rs.getString("token") : null,
                code.trim()
        );
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş kodu geçersiz veya süresi doldu.");
        }
        int consumed = jdbc.update("DELETE FROM auth_exchange_codes WHERE code = ?", code.trim());
        if (consumed == 0) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş kodu geçersiz veya süresi doldu.");
        }
        AuthUser user;
        try {
            user = authenticate(token);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş kodu geçersiz.");
        }
        return new LoginResponse(token, user.username(), user.email());
    }

    public com.testpsikolog.dto.ProfileResponse getProfile(long userId, boolean googleConnected) {
        return jdbc.query(
                "SELECT id, email, username, displayName, reminderHours FROM app_users WHERE id = ?",
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Hesap bulunamadı.");
                    }
                    Integer hours = rs.getObject("reminderHours") == null ? 24 : rs.getInt("reminderHours");
                    String displayName = rs.getString("displayName");
                    if (displayName == null || displayName.isBlank()) {
                        displayName = coalesce(rs.getString("email"), rs.getString("username"));
                    }
                    return new com.testpsikolog.dto.ProfileResponse(
                            rs.getLong("id"),
                            rs.getString("email"),
                            rs.getString("username"),
                            displayName,
                            googleConnected,
                            hours
                    );
                },
                userId
        );
    }

    public com.testpsikolog.dto.ProfileResponse updateProfile(
            long userId,
            com.testpsikolog.dto.UpdateProfileRequest request,
            boolean googleConnected
    ) {
        if (request == null) {
            return getProfile(userId, googleConnected);
        }
        if (request.displayName() != null) {
            String name = request.displayName().trim();
            if (name.isBlank() || name.length() > 80) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Görünen ad 1-80 karakter olmalı.");
            }
            jdbc.update("UPDATE app_users SET displayName = ? WHERE id = ?", name, userId);
        }
        if (request.email() != null) {
            String email = request.email().trim().toLowerCase();
            if (!email.contains("@") || email.length() > 120) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geçerli bir e-posta girin.");
            }
            AuthUser existing = findByLogin(email);
            if (existing != null && existing.id() != null && existing.id() != userId) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu e-posta başka bir hesaba ait.");
            }
            jdbc.update("UPDATE app_users SET email = ? WHERE id = ?", email, userId);
        }
        if (request.reminderHours() != null) {
            int hours = request.reminderHours();
            if (hours != 2 && hours != 12 && hours != 24 && hours != 48) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hatırlatma 2, 12, 24 veya 48 saat olabilir.");
            }
            jdbc.update("UPDATE app_users SET reminderHours = ? WHERE id = ?", hours, userId);
        }
        return getProfile(userId, googleConnected);
    }

    public LoginResponse changePassword(long userId, com.testpsikolog.dto.ChangePasswordRequest request) {
        if (request == null || request.currentPassword() == null || request.newPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mevcut ve yeni şifre gerekli.");
        }
        if (request.newPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Şifre en az 6 karakter olmalı.");
        }
        String hash = jdbc.query(
                "SELECT passwordHash FROM app_users WHERE id = ?",
                rs -> rs.next() ? rs.getString("passwordHash") : null,
                userId
        );
        if (hash == null || !passwordEncoder.matches(request.currentPassword(), hash)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mevcut şifre hatalı.");
        }
        updatePasswordAndRevokeTokens(userId, request.newPassword());
        AuthUser user = findById(userId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Hesap bulunamadı.");
        }
        return toResponse(user);
    }

    public void forgotPassword(com.testpsikolog.dto.ForgotPasswordRequest request) {
        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isBlank() || !email.contains("@")) {
            return;
        }
        AuthUser user = findByLogin(email);
        if (user == null) {
            return;
        }
        jdbc.update("DELETE FROM password_reset_tokens WHERE email = ?", email);
        String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        long expiresAt = java.time.Instant.now().plusSeconds(30 * 60).toEpochMilli();
        jdbc.update(
                "INSERT INTO password_reset_tokens (email, codeHash, expiresAt) VALUES (?, ?, ?)",
                email,
                passwordEncoder.encode(code),
                expiresAt
        );
        try {
            java.nio.file.Path file = java.nio.file.Path.of(System.getProperty("user.dir"), "data", "last-reset-code.txt");
            java.nio.file.Files.createDirectories(file.getParent());
            java.nio.file.Files.writeString(file, "email=" + email + System.lineSeparator() + "code=" + code + System.lineSeparator());
        } catch (Exception ex) {
            System.out.println("Password reset code file could not be written.");
        }
        System.out.println("Password reset code created.");
    }

    public void resetPassword(com.testpsikolog.dto.ResetPasswordRequest request) {
        if (request == null || request.email() == null || request.code() == null || request.newPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta, kod ve yeni şifre gerekli.");
        }
        if (request.newPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Şifre en az 6 karakter olmalı.");
        }
        String email = request.email().trim().toLowerCase();
        String throttleKey = RESET_THROTTLE_PREFIX + email;
        loginThrottle.assertAllowed(throttleKey);
        jdbc.update("DELETE FROM password_reset_tokens WHERE expiresAt < ?", java.time.Instant.now().toEpochMilli());
        String storedHash = jdbc.query(
                "SELECT codeHash FROM password_reset_tokens WHERE email = ? ORDER BY expiresAt DESC LIMIT 1",
                rs -> rs.next() ? rs.getString("codeHash") : null,
                email
        );
        if (storedHash == null || !passwordEncoder.matches(request.code().trim(), storedHash)) {
            loginThrottle.recordFailure(throttleKey);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kod geçersiz veya süresi doldu.");
        }
        AuthUser user = findByLogin(email);
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kod geçersiz veya süresi doldu.");
        }
        updatePasswordAndRevokeTokens(user.id(), request.newPassword());
        jdbc.update("DELETE FROM password_reset_tokens WHERE email = ?", email);
        loginThrottle.reset(throttleKey);
        loginThrottle.reset(LOGIN_THROTTLE_PREFIX + email);
    }

    private void updatePasswordAndRevokeTokens(long userId, String newPassword) {
        jdbc.update(
                "UPDATE app_users SET passwordHash = ?, tokenVersion = COALESCE(tokenVersion, 0) + 1 WHERE id = ?",
                passwordEncoder.encode(newPassword),
                userId
        );
    }

    private int currentTokenVersion(long userId) {
        Integer version = jdbc.query(
                "SELECT tokenVersion FROM app_users WHERE id = ?",
                rs -> rs.next() && rs.getObject("tokenVersion") != null ? rs.getInt("tokenVersion") : 0,
                userId
        );
        return version == null ? 0 : version;
    }

    public java.util.Map<String, Object> exportAccount(long userId) {
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("profile", getProfile(userId, false));
        payload.put("clients", jdbc.queryForList("SELECT id, email, name, birthDate, agreedFee, phone, emergencyName, emergencyPhone, createdAt FROM clients WHERE userId = ?", userId));
        payload.put(
                "appointments",
                jdbc.queryForList(
                        """
                        SELECT a.id, a.clientId, a.appointmentDate, a.appointmentTime, a.title, a.isPaid, a.status,
                               a.durationMinutes, a.sessionFee, a.createdAt
                        FROM appointments a
                        INNER JOIN clients c ON c.id = a.clientId
                        WHERE c.userId = ?
                        """,
                        userId
                )
        );
        payload.put(
                "notes",
                jdbc.queryForList(
                        """
                        SELECT n.id, n.clientId, n.appointmentId, n.title, n.content, n.fileName, n.noteDate, n.createdAt
                        FROM client_notes n
                        INNER JOIN clients c ON c.id = n.clientId
                        WHERE c.userId = ?
                        """,
                        userId
                )
        );
        payload.put("exportedAt", java.time.Instant.now().toString());
        return payload;
    }

    @Transactional
    public void deleteAccount(long userId) {
        Long clinicId = jdbc.query(
                "SELECT clinicId FROM clinic_members WHERE userId = ? AND role = 'owner'",
                rs -> rs.next() ? rs.getLong("clinicId") : null,
                userId
        );
        if (clinicId != null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Kurucu olduğunuz bir klinik var. Önce sahipliği devredin veya kliniği silin."
            );
        }
        List<Long> clientIds = jdbc.query(
                "SELECT id FROM clients WHERE userId = ?",
                (rs, rowNum) -> rs.getLong("id"),
                userId
        );
        String email = jdbc.query(
                "SELECT email FROM app_users WHERE id = ?",
                rs -> rs.next() ? rs.getString("email") : null,
                userId
        );
        for (Long clientId : clientIds) {
            clientService.delete(userId, clientId);
        }
        jdbc.update("DELETE FROM blocked_slots WHERE userId = ?", userId);
        jdbc.update("DELETE FROM clinic_members WHERE userId = ?", userId);
        jdbc.update("DELETE FROM google_tokens WHERE userId = ?", userId);
        if (email != null) {
            jdbc.update("DELETE FROM password_reset_tokens WHERE email = ?", email.toLowerCase());
        }
        jdbc.update("DELETE FROM app_users WHERE id = ?", userId);
        deleteUploadDirectory(userId);
    }

    private static void deleteUploadDirectory(long userId) {
        Path dir = Path.of(System.getProperty("user.dir"), "data", "uploads", String.valueOf(userId));
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(dir)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        } catch (IOException ex) {
            System.out.println("Upload directory delete failed: " + ex.getMessage());
        }
    }

    private static String coalesce(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private LoginResponse toResponse(AuthUser user) {
        return new LoginResponse(
                jwtService.createToken(user.id(), user.username(), currentTokenVersion(user.id())),
                user.username(),
                user.email()
        );
    }

    private AuthUser mapUser(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new AuthUser(rs.getLong("id"), rs.getString("username"), rs.getString("email"));
    }

    private void validatePassword(LoginRequest request) {
        if (request == null || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta ve şifre gerekli.");
        }
    }
}
