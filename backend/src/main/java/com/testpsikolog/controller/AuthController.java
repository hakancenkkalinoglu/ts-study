package com.testpsikolog.controller;

import com.testpsikolog.config.AppProperties;
import com.testpsikolog.dto.AuthExchangeRequest;
import com.testpsikolog.dto.GoogleAuthUrlResponse;
import com.testpsikolog.dto.GoogleStatusResponse;
import com.testpsikolog.dto.LoginRequest;
import com.testpsikolog.dto.LoginResponse;
import com.testpsikolog.dto.MessageResponse;
import com.testpsikolog.service.AuthService;
import com.testpsikolog.service.CurrentUserService;
import com.testpsikolog.service.GoogleCalendarService;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final GoogleCalendarService googleCalendarService;
    private final AppProperties appProperties;
    private final CurrentUserService currentUserService;

    public AuthController(
            AuthService authService,
            GoogleCalendarService googleCalendarService,
            AppProperties appProperties,
            CurrentUserService currentUserService
    ) {
        this.authService = authService;
        this.googleCalendarService = googleCalendarService;
        this.appProperties = appProperties;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/auth/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse register(@RequestBody LoginRequest request) {
        return authService.register(request);
    }

    @GetMapping("/auth/google")
    public GoogleAuthUrlResponse googleAuth() {
        long userId = currentUserService.requireUser().id();
        return new GoogleAuthUrlResponse(googleCalendarService.getAuthUrl(userId));
    }

    @GetMapping("/auth/google/login")
    public GoogleAuthUrlResponse googleLogin() {
        return new GoogleAuthUrlResponse(googleCalendarService.getSignInAuthUrl());
    }

    @GetMapping("/auth/google/callback")
    public void googleCallback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "state", required = false) String state,
            HttpServletResponse response
    ) throws IOException {
        boolean signIn = "signin".equals(state);
        String failPath = signIn ? "/?google=error" : "/takvim?google=error";
        if (code == null || code.isBlank()) {
            response.sendRedirect(appProperties.getFrontendUrl() + (signIn ? "/?google=missing_code" : "/takvim?google=missing_code"));
            return;
        }
        try {
            String jwt = googleCalendarService.completeOAuth(code, state);
            if (jwt != null) {
                String authCode = URLEncoder.encode(authService.createLoginExchange(jwt), StandardCharsets.UTF_8);
                response.sendRedirect(appProperties.getFrontendUrl() + "/?google=success&auth=" + authCode);
                return;
            }
            response.sendRedirect(appProperties.getFrontendUrl() + "/takvim?google=success");
        } catch (Exception ex) {
            response.sendRedirect(appProperties.getFrontendUrl() + failPath);
        }
    }

    @PostMapping("/auth/google/exchange")
    public LoginResponse exchangeGoogle(@RequestBody AuthExchangeRequest request) {
        return authService.consumeLoginExchange(request == null ? null : request.code());
    }

    @GetMapping("/auth/google/status")
    public GoogleStatusResponse googleStatus() {
        long userId = currentUserService.requireUser().id();
        return new GoogleStatusResponse(googleCalendarService.isConnected(userId));
    }

    @DeleteMapping("/auth/google")
    public MessageResponse disconnectGoogle() {
        long userId = currentUserService.requireUser().id();
        googleCalendarService.disconnect(userId);
        return new MessageResponse("Google bağlantısı kesildi.");
    }

    @GetMapping("/auth/me")
    public com.testpsikolog.dto.ProfileResponse me() {
        long userId = currentUserService.requireUser().id();
        return authService.getProfile(userId, googleCalendarService.isConnected(userId));
    }

    @PutMapping("/auth/me")
    public com.testpsikolog.dto.ProfileResponse updateMe(@RequestBody com.testpsikolog.dto.UpdateProfileRequest request) {
        long userId = currentUserService.requireUser().id();
        return authService.updateProfile(userId, request, googleCalendarService.isConnected(userId));
    }

    @PutMapping("/auth/password")
    public MessageResponse changePassword(@RequestBody com.testpsikolog.dto.ChangePasswordRequest request) {
        long userId = currentUserService.requireUser().id();
        authService.changePassword(userId, request);
        return new MessageResponse("Şifre güncellendi.");
    }

    @PostMapping("/auth/forgot-password")
    public MessageResponse forgotPassword(@RequestBody com.testpsikolog.dto.ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return new MessageResponse(
                "Eşleşen bir hesap varsa sıfırlama kodu üretildi. Yerel kurulumda kod backend/data/last-reset-code.txt dosyasına yazılır."
        );
    }

    @PostMapping("/auth/reset-password")
    public MessageResponse resetPassword(@RequestBody com.testpsikolog.dto.ResetPasswordRequest request) {
        authService.resetPassword(request);
        return new MessageResponse("Şifreniz güncellendi. Yeni şifre ile giriş yapabilirsiniz.");
    }

    @GetMapping("/auth/export")
    public java.util.Map<String, Object> exportAccount() {
        long userId = currentUserService.requireUser().id();
        return authService.exportAccount(userId);
    }

    @DeleteMapping("/auth/me")
    public MessageResponse deleteAccount() {
        long userId = currentUserService.requireUser().id();
        authService.deleteAccount(userId);
        return new MessageResponse("Hesabınız ve kayıtlarınız silindi.");
    }
}
