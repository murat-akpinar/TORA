package com.projectspring.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class TokenBlacklistService {

    // Tokens are automatically evicted after 24 h (matches JWT expiry).
    // Capacity of 10 000 covers concurrent active sessions comfortably.
    private final Cache<String, Boolean> blacklist = Caffeine.newBuilder()
            .expireAfterWrite(24, TimeUnit.HOURS)
            .maximumSize(10_000)
            .build();

    public void blacklistToken(String token) {
        blacklist.put(token, Boolean.TRUE);
    }

    public boolean isBlacklisted(String token) {
        return Boolean.TRUE.equals(blacklist.getIfPresent(token));
    }
}
