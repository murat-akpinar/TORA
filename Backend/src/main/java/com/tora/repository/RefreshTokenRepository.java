package com.tora.repository;

import com.tora.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);
    long deleteByTokenHash(String tokenHash);
    long deleteByExpiresAtBefore(LocalDateTime cutoff);

    List<RefreshToken> findByUsernameAndExpiresAtAfterOrderByCreatedAtDesc(String username, LocalDateTime now);
    long deleteByUsernameAndTokenHashNot(String username, String tokenHash);
}
