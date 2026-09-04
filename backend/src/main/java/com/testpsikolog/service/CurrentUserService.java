package com.testpsikolog.service;

import com.testpsikolog.security.AuthUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    public AuthUser requireUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser user) || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş yapmanız gerekiyor.");
        }
        return user;
    }
}
