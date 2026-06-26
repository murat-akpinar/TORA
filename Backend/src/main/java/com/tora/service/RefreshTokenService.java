package com.tora.service;

import com.tora.model.RefreshToken;
import com.tora.repository.RefreshTokenRepository;
import com.tora.security.TokenHashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Database-backed refresh token store. Refresh tokens live 7 days and are
 * rotated on use. Persisting them (instead of an in-memory cache) keeps
 * sessions valid across backend restarts and shared across instances. Only the
 * SHA-256 hash of the opaque token is stored.
 */
@Service
public class RefreshTokenService {

    private static final Logger logger = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final int REFRESH_TOKEN_TTL_DAYS = 7;

    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public String createRefreshToken(String username) {
        String token = UUID.randomUUID().toString();
        RefreshToken entity = new RefreshToken();
        entity.setTokenHash(TokenHashUtil.sha256(token));
        entity.setUsername(username);
        entity.setExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusDays(REFRESH_TOKEN_TTL_DAYS));
        refreshTokenRepository.save(entity);
        return token;
    }

    /** Returns the username bound to this refresh token, or null if expired/unknown. */
    public String getUsernameForToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return null;
        }
        return refreshTokenRepository.findByTokenHash(TokenHashUtil.sha256(refreshToken))
                .filter(rt -> rt.getExpiresAt().isAfter(LocalDateTime.now(ZoneOffset.UTC)))
                .map(RefreshToken::getUsername)
                .orElse(null);
    }

    @Transactional
    public void invalidate(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.deleteByTokenHash(TokenHashUtil.sha256(refreshToken));
    }

    /** Purge expired refresh tokens every hour. */
    @Scheduled(cron = "0 20 * * * *")
    @Transactional
    public void purgeExpired() {
        long removed = refreshTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now(ZoneOffset.UTC));
        if (removed > 0) {
            logger.debug("Purged {} expired refresh tokens", removed);
        }
    }
}
