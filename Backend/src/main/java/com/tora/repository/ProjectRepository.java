package com.tora.repository;

import com.tora.model.Project;
import com.tora.model.enums.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    
    List<Project> findByStatus(ProjectStatus status);
    
    @Query("SELECT DISTINCT p FROM Project p JOIN p.teams t WHERE t.id IN :teamIds")
    List<Project> findByTeamIds(@Param("teamIds") List<Long> teamIds);
    
    @Query("SELECT DISTINCT p FROM Project p JOIN p.teams t WHERE t.id = :teamId")
    List<Project> findByTeamId(@Param("teamId") Long teamId);
    
    Optional<Project> findByName(String name);

    List<Project> findByManagerId(Long managerId);

    @Query(value = "SELECT DISTINCT p.id FROM projects p " +
                   "JOIN project_teams pt ON p.id = pt.project_id " +
                   "WHERE pt.team_id IN :teamIds " +
                   "AND to_tsvector('simple', p.name || ' ' || coalesce(p.description, '')) " +
                   "    @@ plainto_tsquery('simple', :query) " +
                   "LIMIT :lim", nativeQuery = true)
    List<Long> searchIdsByTeamIdsAndQuery(@Param("teamIds") List<Long> teamIds,
                                          @Param("query") String query,
                                          @Param("lim") int lim);
}

