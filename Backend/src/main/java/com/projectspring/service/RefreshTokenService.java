package com.projectspring.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class RefreshTokenService {

    // Refresh tokens live 7 days; max 10 000 active sessions
    private final Cache<String, String> tokenToUsername = Caffeine.newBuilder()
            .expireAfterWrite(7, TimeUnit.DAYS)
            .maximumSize(10_000)
            .build();

    public String createRefreshToken(String username) {
        String token = UUID.randomUUID().toString();
        tokenToUsername.put(token, username);
        return token;
    }

    /** Returns the username bound to this refresh token, or null if expired/unknown. */
    public String getUsernameForToken(String refreshToken) {
        return tokenToUsername.getIfPresent(refreshToken);
    }

    public void invalidate(String refreshToken) {
        tokenToUsername.invalidate(refreshToken);
    }
}
