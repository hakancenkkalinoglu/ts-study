package com.testpsikolog.service;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.security.JwtService;
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
        if (request == null || request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kullanıcı adı ve şifre gerekli.");
        }
        String username = request.username().trim();
        String hash = jdbc.query(
                "SELECT passwordHash FROM app_users WHERE username = ?",
                rs -> rs.next() ? rs.getString("passwordHash") : null,
                username
        );
        if (hash == null || !passwordEncoder.matches(request.password(), hash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Kullanıcı adı veya şifre hatalı.");
        }
        return new LoginResponse(jwtService.createToken(username), username);
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
}
