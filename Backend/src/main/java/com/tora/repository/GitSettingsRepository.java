package com.tora.repository;

import com.tora.model.GitSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GitSettingsRepository extends JpaRepository<GitSettings, Long> {
    Optional<GitSettings> findTopByOrderByIdAsc();
}
