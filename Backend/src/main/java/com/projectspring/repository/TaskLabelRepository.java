package com.projectspring.repository;

import com.projectspring.model.TaskLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskLabelRepository extends JpaRepository<TaskLabel, Long> {

    List<TaskLabel> findByTeamIdOrderByNameAsc(Long teamId);

    @Query("SELECT l FROM TaskLabel l WHERE l.team.id = :teamId " +
           "AND LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%')) ORDER BY l.name ASC")
    List<TaskLabel> searchByTeamIdAndName(@Param("teamId") Long teamId, @Param("search") String search);

    Optional<TaskLabel> findByNameIgnoreCaseAndTeamId(String name, Long teamId);

    long countByTeamId(Long teamId);
}
