package com.tora.service;

import com.tora.model.RevokedToken;
import com.tora.repository.RevokedTokenRepository;
import com.tora.security.TokenHashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * Database-backed blacklist of revoked JWT access tokens. Persisting the
 * blacklist (instead of an in-memory cache) keeps revocations effective across
 * backend restarts and shared across multiple instances. Tokens are stored as
 * SHA-256 hashes with their natural expiry; expired rows are purged on a
 * schedule (the underlying JWT is rejected by signature/expiry checks anyway).
 */
@Service
public class TokenBlacklistService {

    private static final Logger logger = LoggerFactory.getLogger(TokenBlacklistService.class);

    private final RevokedTokenRepository revokedTokenRepository;
    private final JwtService jwtService;

    public TokenBlacklistService(RevokedTokenRepository revokedTokenRepository, JwtService jwtService) {
        this.revokedTokenRepository = revokedTokenRepository;
        this.jwtService = jwtService;
    }

    public void blacklistToken(String token) {
        String hash = TokenHashUtil.sha256(token);
        if (revokedTokenRepository.existsByTokenHash(hash)) {
            return;
        }
        LocalDateTime expiresAt;
        try {
            expiresAt = jwtService.extractExpiration(token).toInstant()
                    .atZone(ZoneOffset.UTC).toLocalDateTime();
        } catch (Exception e) {
            // Token unparseable/expired — keep it briefly so it can't be reused.
            expiresAt = LocalDateTime.now(ZoneOffset.UTC).plusHours(24);
        }
        RevokedToken revoked = new RevokedToken();
        revoked.setTokenHash(hash);
        revoked.setExpiresAt(expiresAt);
        try {
            revokedTokenRepository.save(revoked);
        } catch (Exception e) {
            // A concurrent logout may have inserted the same hash; ignore the
            // unique-constraint race — the token is blacklisted either way.
            logger.debug("Token already blacklisted concurrently: {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String token) {
        return revokedTokenRepository.existsByTokenHash(TokenHashUtil.sha256(token));
    }

    /** Purge expired blacklist entries every hour. */
    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public void purgeExpired() {
        long removed = revokedTokenRepository.deleteByExpiresAtBefore(LocalDateTime.now(ZoneOffset.UTC));
        if (removed > 0) {
            logger.debug("Purged {} expired revoked tokens", removed);
        }
    }
}
