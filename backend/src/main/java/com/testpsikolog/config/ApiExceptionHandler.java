package com.testpsikolog.config;

import com.testpsikolog.dto.MessageResponse;
import com.testpsikolog.util.DbErrors;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<MessageResponse> handleStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String message = ex.getReason() == null ? status.getReasonPhrase() : ex.getReason();
        return ResponseEntity.status(status).body(new MessageResponse(message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MessageResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new MessageResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<MessageResponse> handleIllegalState(IllegalStateException ex) {
        String message = ex.getMessage() == null ? "Internal server error" : ex.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new MessageResponse(message));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<MessageResponse> handleDataAccess(DataAccessException ex) {
        if (DbErrors.isUniqueViolation(ex)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new MessageResponse("Bu kayıt zaten mevcut."));
        }
        if (DbErrors.isOverlapViolation(ex)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new MessageResponse(DbErrors.overlapMessage(ex)));
        }
        if (DbErrors.isBusy(ex)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new MessageResponse("Sistem şu an yoğun. Birkaç saniye sonra tekrar deneyin."));
        }
        System.out.println("Database error: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Beklenmeyen bir veritabanı hatası oluştu."));
    }
}
