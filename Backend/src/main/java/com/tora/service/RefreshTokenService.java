package com.tora.service;

import com.tora.dto.SessionDTO;
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
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Database-backed refresh token store. Refresh tokens live 7 days and are
 * rotated on use. Persisting them (instead of an in-memory cache) keeps
 * sessions valid across backend restarts and shared across instances. Only the
 * SHA-256 hash of the opaque token is stored. Each row doubles as a "session"
 * for the session-management UI (IP + device + date).
 */
@Service
public class RefreshTokenService {

    private static final Logger logger = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final int REFRESH_TOKEN_TTL_DAYS = 7;

    private final RefreshTokenRepository refreshTokenRepository;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public String createRefreshToken(String username, String ipAddress, String userAgent) {
        String token = UUID.randomUUID().toString();
        RefreshToken entity = new RefreshToken();
        entity.setTokenHash(TokenHashUtil.sha256(token));
        entity.setUsername(username);
        entity.setIpAddress(ipAddress);
        entity.setUserAgent(truncate(userAgent, 512));
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

    /** Active (non-expired) sessions for a user; the row matching the caller's
     *  current refresh token (if supplied) is flagged as current. */
    public List<SessionDTO> getActiveSessions(String username, String currentRefreshToken) {
        String currentHash = (currentRefreshToken == null || currentRefreshToken.isBlank())
                ? null : TokenHashUtil.sha256(currentRefreshToken);
        return refreshTokenRepository
                .findByUsernameAndExpiresAtAfterOrderByCreatedAtDesc(username, LocalDateTime.now(ZoneOffset.UTC))
                .stream()
                .map(rt -> new SessionDTO(
                        rt.getId(),
                        rt.getIpAddress(),
                        rt.getUserAgent(),
                        rt.getCreatedAt(),
                        rt.getExpiresAt(),
                        currentHash != null && currentHash.equals(rt.getTokenHash())))
                .collect(Collectors.toList());
    }

    /** Revoke a single session by id, only if it belongs to the given user. */
    @Transactional
    public boolean revokeSession(String username, Long sessionId) {
        return refreshTokenRepository.findById(sessionId)
                .filter(rt -> rt.getUsername().equals(username))
                .map(rt -> {
                    refreshTokenRepository.delete(rt);
                    return true;
                })
                .orElse(false);
    }

    /** Revoke all of the user's sessions except the current one. */
    @Transactional
    public long logoutOtherSessions(String username, String currentRefreshToken) {
        String currentHash = (currentRefreshToken == null || currentRefreshToken.isBlank())
                ? "" : TokenHashUtil.sha256(currentRefreshToken);
        return refreshTokenRepository.deleteByUsernameAndTokenHashNot(username, currentHash);
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

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
