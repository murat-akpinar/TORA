package com.tora.service;

import com.tora.dto.*;
import com.tora.model.Team;
import com.tora.model.User;
import com.tora.model.enums.TaskStatus;
import com.tora.repository.TaskRepository;
import com.tora.repository.TeamRepository;
import com.tora.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TeamService teamService;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private UserRepository userRepository;

    public DashboardStatsDTO getTeamDashboardStats(Long teamId) {
        return getTeamDashboardStats(teamId, null, null);
    }

    @Cacheable(value = "dashboardStats", key = "#teamId + ':' + #startDate + ':' + #endDate")
    public DashboardStatsDTO getTeamDashboardStats(Long teamId, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();

        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }

        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;

        // SQL GROUP BY ile tek sorguda status sayımı
        List<Object[]> rows = (startDate != null && endDate != null)
                ? taskRepository.countByTeamIdsAndDateRangeGroupByStatus(teamIds, startDate, endDate)
                : taskRepository.countByTeamIdsGroupByStatus(teamIds);

        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalOpen(0L);
        stats.setTotalInProgress(0L);
        stats.setTotalTesting(0L);
        stats.setTotalCompleted(0L);
        stats.setTotalCancelled(0L);

        for (Object[] row : rows) {
            TaskStatus status = (TaskStatus) row[0];
            Long count = (Long) row[1];
            switch (status) {
                case OPEN        -> stats.setTotalOpen(count);
                case IN_PROGRESS -> stats.setTotalInProgress(count);
                case TESTING     -> stats.setTotalTesting(count);
                case COMPLETED   -> stats.setTotalCompleted(count);
                case CANCELLED   -> stats.setTotalCancelled(count);
            }
        }

        return stats;
    }

    public DashboardDetailsDTO getTeamDashboardDetails(Long teamId) {
        return getTeamDashboardDetails(teamId, null, null);
    }

    @Cacheable(value = "dashboardDetails", key = "#teamId + ':' + #startDate + ':' + #endDate")
    public DashboardDetailsDTO getTeamDashboardDetails(Long teamId, LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();

        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }

        DashboardStatsDTO stats = getTeamDashboardStats(teamId, startDate, endDate);
        List<UserLeaderboardDTO> topCompleters = getTopAssignees(teamId, TaskStatus.COMPLETED, startDate, endDate);
        List<UserLeaderboardDTO> topCancellers = getTopAssignees(teamId, TaskStatus.CANCELLED, startDate, endDate);
        List<TeamMemberDTO> teamMembers = getTeamMembers(teamId);

        return new DashboardDetailsDTO(stats, topCompleters, topCancellers, teamMembers);
    }

    private List<UserLeaderboardDTO> getTopAssignees(Long teamId, TaskStatus status,
                                                      LocalDate startDate, LocalDate endDate) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;

        List<Object[]> rows = (startDate != null && endDate != null)
                ? taskRepository.findTopAssigneesByTeamIdsAndStatusAndDateRange(teamIds, status, startDate, endDate)
                : taskRepository.findTopAssigneesByTeamIdsAndStatus(teamIds, status);

        return rows.stream()
                .limit(5)
                .map(row -> new UserLeaderboardDTO((Long) row[0], (String) row[1], (Long) row[2]))
                .collect(Collectors.toList());
    }

    private List<TeamMemberDTO> getTeamMembers(Long teamId) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();

        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }

        List<TeamMemberDTO> members = new ArrayList<>();

        if (teamId != null) {
            Team team = teamRepository.findById(teamId).orElse(null);
            if (team != null) {
                List<User> teamUsers = userRepository.findByTeamId(teamId);
                for (User user : teamUsers) {
                    if (isAdminRoleUser(user)) continue;
                    List<String> roleNames = user.getRoles().stream()
                            .map(role -> role.getName())
                            .collect(Collectors.toList());
                    boolean isLeader = team.getLeader() != null && team.getLeader().getId().equals(user.getId());
                    members.add(new TeamMemberDTO(user.getId(), user.getFullName(), roleNames, isLeader, team.getName()));
                }
            }
        } else {
            for (Long tid : accessibleTeamIds) {
                Team team = teamRepository.findById(tid).orElse(null);
                if (team != null) {
                    List<User> teamUsers = userRepository.findByTeamId(tid);
                    for (User user : teamUsers) {
                        if (isAdminRoleUser(user)) continue;
                        boolean exists = members.stream().anyMatch(m -> m.getUserId().equals(user.getId()));
                        if (!exists) {
                            List<String> roleNames = user.getRoles().stream()
                                    .map(role -> role.getName())
                                    .collect(Collectors.toList());
                            boolean isLeader = team.getLeader() != null && team.getLeader().getId().equals(user.getId());
                            members.add(new TeamMemberDTO(user.getId(), user.getFullName(), roleNames, isLeader, team.getName()));
                        }
                    }
                }
            }
        }

        members.sort((a, b) -> {
            if (a.getIsLeader() && !b.getIsLeader()) return -1;
            if (!a.getIsLeader() && b.getIsLeader()) return 1;
            return a.getUserName().compareToIgnoreCase(b.getUserName());
        });

        return members;
    }

    /** Yönetici (ADMIN) birim personeli değildir; üye listelerinde gösterilmez. */
    private boolean isAdminRoleUser(User user) {
        return user.getRoles().stream()
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
    }
}
