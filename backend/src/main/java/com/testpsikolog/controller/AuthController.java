package com.testpsikolog.controller;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.GoogleStatusResponse;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.service.AuthService;
import com.testpsikolog.service.GoogleCalendarService;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final GoogleCalendarService googleCalendarService;
    private final AppProperties appProperties;

    public AuthController(
            AuthService authService,
            GoogleCalendarService googleCalendarService,
            AppProperties appProperties
    ) {
        this.authService = authService;
        this.googleCalendarService = googleCalendarService;
        this.appProperties = appProperties;
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/auth/google")
    public void googleAuth(HttpServletResponse response) throws IOException {
        try {
            response.sendRedirect(googleCalendarService.getAuthUrl());
        } catch (Exception ex) {
            response.sendRedirect(appProperties.getFrontendUrl() + "?google=error");
        }
    }

    @GetMapping("/auth/google/callback")
    public void googleCallback(@RequestParam(value = "code", required = false) String code, HttpServletResponse response) throws IOException {
        if (code == null || code.isBlank()) {
            response.sendRedirect(appProperties.getFrontendUrl() + "?google=missing_code");
            return;
        }
        try {
            googleCalendarService.exchangeCode(code);
            response.sendRedirect(appProperties.getFrontendUrl() + "?google=success");
        } catch (Exception ex) {
            response.sendRedirect(appProperties.getFrontendUrl() + "?google=error");
        }
    }

    @GetMapping("/auth/google/status")
    public GoogleStatusResponse googleStatus() {
        return new GoogleStatusResponse(googleCalendarService.isConnected());
    }
}
