package com.tora.repository;

import com.tora.model.TaskStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskStatusHistoryRepository extends JpaRepository<TaskStatusHistory, Long> {
    List<TaskStatusHistory> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    @Query("SELECT tsh FROM TaskStatusHistory tsh WHERE tsh.task.team.id IN :teamIds AND tsh.newStatus = 'COMPLETED'")
    List<TaskStatusHistory> findCompletionHistoryByTeamIds(@Param("teamIds") List<Long> teamIds);
}

