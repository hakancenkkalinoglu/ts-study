package com.testpsikolog.config;

import com.testpsikolog.service.AuthService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements ApplicationRunner {

    private final AuthService authService;

    public DataSeeder(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void run(ApplicationArguments args) {
        authService.seedDefaultUser();
    }
}
