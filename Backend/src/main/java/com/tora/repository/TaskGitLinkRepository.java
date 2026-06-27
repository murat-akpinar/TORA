package com.tora.repository;

import com.tora.model.TaskGitLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TaskGitLinkRepository extends JpaRepository<TaskGitLink, Long> {
    Optional<TaskGitLink> findByTask_IdAndPlatformAndLinkTypeAndExternalId(
        Long taskId, String platform, String linkType, String externalId);
    List<TaskGitLink> findByTask_IdOrderByCreatedAtDesc(Long taskId);
}
