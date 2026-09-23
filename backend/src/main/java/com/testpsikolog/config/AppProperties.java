package com.testpsikolog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String jwtSecret = "";
    private long jwtExpirationMs = 604800000L;
    private String frontendUrl = "http://localhost:5174";
    private String corsOrigins = "http://localhost:5173,http://localhost:5174";
    private boolean seedEnabled = false;
    private String seedUsername = "";
    private String seedPassword = "";
    private boolean mockDataEnabled = false;
    private String mockPassword = "";
    private final Google google = new Google();

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    public long getJwtExpirationMs() {
        return jwtExpirationMs;
    }

    public void setJwtExpirationMs(long jwtExpirationMs) {
        this.jwtExpirationMs = jwtExpirationMs;
    }

    public String getFrontendUrl() {
        return frontendUrl;
    }

    public void setFrontendUrl(String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    public String getCorsOrigins() {
        return corsOrigins;
    }

    public void setCorsOrigins(String corsOrigins) {
        this.corsOrigins = corsOrigins;
    }

    public boolean isSeedEnabled() {
        return seedEnabled;
    }

    public void setSeedEnabled(boolean seedEnabled) {
        this.seedEnabled = seedEnabled;
    }

    public String getSeedUsername() {
        return seedUsername;
    }

    public void setSeedUsername(String seedUsername) {
        this.seedUsername = seedUsername;
    }

    public String getSeedPassword() {
        return seedPassword;
    }

    public void setSeedPassword(String seedPassword) {
        this.seedPassword = seedPassword;
    }

    public boolean isMockDataEnabled() {
        return mockDataEnabled;
    }

    public void setMockDataEnabled(boolean mockDataEnabled) {
        this.mockDataEnabled = mockDataEnabled;
    }

    public String getMockPassword() {
        return mockPassword;
    }

    public void setMockPassword(String mockPassword) {
        this.mockPassword = mockPassword;
    }

    public Google getGoogle() {
        return google;
    }

    public static class Google {
        private String clientId = "";
        private String clientSecret = "";
        private String redirectUri = "http://localhost:3000/api/auth/google/callback";
        private String tokensPath = "./data/google-tokens.json";

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public String getRedirectUri() {
            return redirectUri;
        }

        public void setRedirectUri(String redirectUri) {
            this.redirectUri = redirectUri;
        }

        public String getTokensPath() {
            return tokensPath;
        }

        public void setTokensPath(String tokensPath) {
            this.tokensPath = tokensPath;
        }
    }
}
