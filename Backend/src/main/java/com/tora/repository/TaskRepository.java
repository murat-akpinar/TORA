package com.tora.repository;

import com.tora.model.Task;
import com.tora.model.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;


@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id = :teamId")
    List<Task> findByTeamId(@Param("teamId") Long teamId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id = :teamId AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByTeamIdAndYear(@Param("teamId") Long teamId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id = :teamId AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByTeamIdAndYearAndMonth(@Param("teamId") Long teamId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT t FROM Task t JOIN t.assignees a WHERE a.id = :userId")
    List<Task> findByAssigneeId(@Param("userId") Long userId);

    @Query("SELECT t FROM Task t WHERE t.team.id = :teamId AND t.status = :status")
    List<Task> findByTeamIdAndStatus(@Param("teamId") Long teamId, @Param("status") TaskStatus status);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id IN :teamIds AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByTeamIdsAndYear(@Param("teamIds") List<Long> teamIds, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id IN :teamIds AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByTeamIdsAndYearAndMonth(@Param("teamIds") List<Long> teamIds, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id IN :teamIds AND t.startDate <= :endDate AND t.endDate >= :startDate")
    List<Task> findByTeamIdsAndDateRange(@Param("teamIds") List<Long> teamIds,
                                         @Param("startDate") LocalDate startDate,
                                         @Param("endDate") LocalDate endDate);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id = :teamId AND t.startDate <= :endDate AND t.endDate >= :startDate")
    List<Task> findByTeamIdAndDateRange(@Param("teamId") Long teamId,
                                        @Param("startDate") LocalDate startDate,
                                        @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.id = :projectId")
    Long countByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.project.id = :projectId AND t.status = :status")
    Long countByProjectIdAndStatus(@Param("projectId") Long projectId, @Param("status") TaskStatus status);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.project.id = :projectId")
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.project.id = :projectId AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByProjectIdAndYear(@Param("projectId") Long projectId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.project.id = :projectId AND t.startDate >= :from AND t.startDate < :to")
    List<Task> findByProjectIdAndYearAndMonth(@Param("projectId") Long projectId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("SELECT t FROM Task t WHERE t.endDate = :endDate AND t.status NOT IN (:excludedStatuses)")
    List<Task> findByEndDateAndStatusNotIn(@Param("endDate") LocalDate endDate,
                                            @Param("excludedStatuses") List<TaskStatus> excludedStatuses);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.assignees WHERE t.status NOT IN (:excludedStatuses)")
    List<Task> findByStatusNotIn(@Param("excludedStatuses") List<TaskStatus> excludedStatuses);

    @Query("SELECT t.slaStatus, COUNT(t) FROM Task t WHERE t.slaStatus IS NOT NULL " +
           "AND (:teamId IS NULL OR t.team.id = :teamId) GROUP BY t.slaStatus")
    List<Object[]> countBySlaStatus(@Param("teamId") Long teamId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.team LEFT JOIN FETCH t.createdBy LEFT JOIN FETCH t.project WHERE t.team.id IN :teamIds")
    List<Task> findByTeamIds(@Param("teamIds") List<Long> teamIds);

    @Query("SELECT t FROM Task t WHERE t.team.id IN :teamIds AND t.createdAt >= :startDate AND t.createdAt < :endDate")
    List<Task> findByTeamIdsAndCreatedAtBetween(@Param("teamIds") List<Long> teamIds,
                                                @Param("startDate") LocalDateTime startDate,
                                                @Param("endDate") LocalDateTime endDate);

    @Query("SELECT t FROM Task t WHERE t.team.id = :teamId AND t.createdAt >= :startDate AND t.createdAt < :endDate")
    List<Task> findByTeamIdAndCreatedAtBetween(@Param("teamId") Long teamId,
                                               @Param("startDate") LocalDateTime startDate,
                                               @Param("endDate") LocalDateTime endDate);

    // Full-text search: erişilebilir birimler içinde, tsvector + plainto_tsquery ile
    @Query(value = "SELECT t.id FROM tasks t " +
                   "WHERE t.team_id IN :teamIds " +
                   "AND to_tsvector('simple', t.title || ' ' || coalesce(t.content, '')) " +
                   "    @@ plainto_tsquery('simple', :query) " +
                   "ORDER BY ts_rank(to_tsvector('simple', t.title || ' ' || coalesce(t.content, '')), " +
                   "                 plainto_tsquery('simple', :query)) DESC " +
                   "LIMIT :lim", nativeQuery = true)
    List<Long> searchIdsByTeamIdsAndQuery(@Param("teamIds") List<Long> teamIds,
                                          @Param("query") String query,
                                          @Param("lim") int lim);

    // Dashboard: birim bazlı status sayımı (SQL aggregate — Java stream sayımı yok)
    @Query("SELECT t.status, COUNT(t) FROM Task t WHERE t.team.id IN :teamIds GROUP BY t.status")
    List<Object[]> countByTeamIdsGroupByStatus(@Param("teamIds") List<Long> teamIds);

    @Query("SELECT t.status, COUNT(t) FROM Task t WHERE t.team.id IN :teamIds AND t.startDate <= :endDate AND t.endDate >= :startDate GROUP BY t.status")
    List<Object[]> countByTeamIdsAndDateRangeGroupByStatus(@Param("teamIds") List<Long> teamIds,
                                                           @Param("startDate") LocalDate startDate,
                                                           @Param("endDate") LocalDate endDate);

    // Dashboard leaderboard: tamamlayan/iptal eden kullanıcı sıralaması
    @Query("SELECT a.id, a.fullName, COUNT(t) FROM Task t JOIN t.assignees a WHERE t.team.id IN :teamIds AND t.status = :status GROUP BY a.id, a.fullName ORDER BY COUNT(t) DESC")
    List<Object[]> findTopAssigneesByTeamIdsAndStatus(@Param("teamIds") List<Long> teamIds,
                                                      @Param("status") TaskStatus status);

    @Query("SELECT a.id, a.fullName, COUNT(t) FROM Task t JOIN t.assignees a WHERE t.team.id IN :teamIds AND t.status = :status AND t.startDate <= :endDate AND t.endDate >= :startDate GROUP BY a.id, a.fullName ORDER BY COUNT(t) DESC")
    List<Object[]> findTopAssigneesByTeamIdsAndStatusAndDateRange(@Param("teamIds") List<Long> teamIds,
                                                                  @Param("status") TaskStatus status,
                                                                  @Param("startDate") LocalDate startDate,
                                                                  @Param("endDate") LocalDate endDate);
}
