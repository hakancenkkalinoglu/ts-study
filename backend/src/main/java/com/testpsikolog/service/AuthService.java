package com.testpsikolog.service;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.security.AuthUser;
import com.testpsikolog.security.JwtService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties appProperties;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AppProperties appProperties
    ) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.appProperties = appProperties;
    }

    public LoginResponse login(LoginRequest request) {
        validatePassword(request);
        String loginId = request.loginId();
        if (loginId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "E-posta gerekli.");
        }
        AuthUser user = findByLogin(loginId);
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-posta veya şifre hatalı.");
        }
        String hash = jdbc.query(
                "SELECT passwordHash FROM app_users WHERE id = ?",
                rs -> rs.next() ? rs.getString("passwordHash") : null,
                user.id()
        );
        if (hash == null || !passwordEncoder.matches(request.password(), hash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-posta veya şifre hatalı.");
        }
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
        String hash = passwordEncoder.encode(request.password());
        jdbc.update(
                "INSERT INTO app_users (username, email, passwordHash) VALUES (?, ?, ?)",
                email,
                email,
                hash
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
                "INSERT INTO app_users (username, email, passwordHash) VALUES (?, ?, ?)",
                email,
                email,
                hash
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

    public AuthUser resolveFromToken(AuthUser parsed) {
        if (parsed.id() != null) {
            return findById(parsed.id());
        }
        return findByLogin(parsed.username());
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
        Integer existing = jdbc.query(
                "SELECT id FROM app_users WHERE username = ?",
                rs -> rs.next() ? rs.getInt("id") : null,
                appProperties.getSeedUsername()
        );
        if (existing != null) {
            return;
        }
        String hash = passwordEncoder.encode(appProperties.getSeedPassword());
        jdbc.update(
                "INSERT INTO app_users (username, passwordHash) VALUES (?, ?)",
                appProperties.getSeedUsername(),
                hash
        );
        System.out.println("Varsayılan giriş kullanıcısı oluşturuldu: " + appProperties.getSeedUsername());
    }

    private LoginResponse toResponse(AuthUser user) {
        return new LoginResponse(
                jwtService.createToken(user.id(), user.username()),
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
