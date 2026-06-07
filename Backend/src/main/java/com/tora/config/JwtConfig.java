package com.tora.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class JwtConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(JwtConfig.class);
    
    @Value("${jwt.secret}")
    private String jwtSecret;
    
    private static final String DEFAULT_SECRET = "your-secret-key-change-this-in-production-min-256-bits";
    private static final int MIN_SECRET_LENGTH = 32; // 256 bits = 32 bytes
    
    @Value("${ENFORCE_SECRET_VALIDATION:true}")
    private boolean enforceSecretValidation;

    @EventListener(ApplicationReadyEvent.class)
    public void validateJwtSecret() {
        if (jwtSecret == null || jwtSecret.trim().isEmpty()) {
            String msg = "CRITICAL: JWT_SECRET environment variable is not set. Set a strong random value (min 32 chars).";
            logger.error(msg);
            if (enforceSecretValidation) throw new IllegalStateException(msg);
            return;
        }

        if (DEFAULT_SECRET.equals(jwtSecret)) {
            String msg = "CRITICAL: JWT_SECRET is set to the known default value. This allows JWT token forgery. " +
                         "Set a strong random value: openssl rand -base64 32. " +
                         "To skip this check (dev only) set ENFORCE_SECRET_VALIDATION=false";
            logger.error(msg);
            if (enforceSecretValidation) throw new IllegalStateException(msg);
            return;
        }

        if (jwtSecret.length() < MIN_SECRET_LENGTH) {
            logger.warn("JWT secret is too short ({} chars). Minimum recommended: {} chars.", jwtSecret.length(), MIN_SECRET_LENGTH);
        } else {
            logger.info("JWT secret validation passed (length: {} characters)", jwtSecret.length());
        }
    }
}

