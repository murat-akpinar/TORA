package com.projectspring.service;

import com.projectspring.dto.*;
import com.projectspring.model.Project;
import com.projectspring.model.Task;
import com.projectspring.model.User;
import com.projectspring.repository.ProjectRepository;
import com.projectspring.repository.TaskRepository;
import com.projectspring.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class SearchService {

    private static final int MAX_RESULTS_PER_TYPE = 5;
    private static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_QUERY_LENGTH = 100;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamService teamService;

    public SearchResultDTO search(String rawQuery) {
        String query = sanitize(rawQuery);
        if (query.length() < MIN_QUERY_LENGTH) {
            return new SearchResultDTO(List.of(), List.of(), List.of());
        }

        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (accessibleTeamIds.isEmpty()) {
            return new SearchResultDTO(List.of(), List.of(), List.of());
        }

        List<TaskSearchResultDTO> tasks = searchTasks(query, accessibleTeamIds);
        List<ProjectSearchResultDTO> projects = searchProjects(query, accessibleTeamIds);
        List<UserSearchResultDTO> users = searchUsers(query, accessibleTeamIds);

        return new SearchResultDTO(tasks, projects, users);
    }

    private List<TaskSearchResultDTO> searchTasks(String query, List<Long> teamIds) {
        try {
            List<Long> ids = taskRepository.searchIdsByTeamIdsAndQuery(teamIds, query, MAX_RESULTS_PER_TYPE);
            if (ids.isEmpty()) return List.of();
            return taskRepository.findAllById(ids).stream()
                    .map(this::toTaskResult)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // FTS parse hatası olursa boş döndür (geçersiz özel karakterler vb.)
            return List.of();
        }
    }

    private List<ProjectSearchResultDTO> searchProjects(String query, List<Long> teamIds) {
        try {
            List<Long> ids = projectRepository.searchIdsByTeamIdsAndQuery(teamIds, query, MAX_RESULTS_PER_TYPE);
            if (ids.isEmpty()) return List.of();
            return projectRepository.findAllById(ids).stream()
                    .map(p -> new ProjectSearchResultDTO(p.getId(), p.getName(), p.getDescription(), p.getStatus()))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<UserSearchResultDTO> searchUsers(String query, List<Long> teamIds) {
        return userRepository.searchByTeamIdsAndQuery(teamIds, query).stream()
                .limit(MAX_RESULTS_PER_TYPE)
                .map(u -> new UserSearchResultDTO(
                        u.getId(),
                        u.getFullName(),
                        u.getUsername(),
                        u.getRoles().stream().map(r -> r.getName()).collect(Collectors.toList())
                ))
                .collect(Collectors.toList());
    }

    private TaskSearchResultDTO toTaskResult(Task t) {
        return new TaskSearchResultDTO(
                t.getId(),
                t.getTitle(),
                t.getStatus(),
                t.getPriority(),
                t.getTeam().getId(),
                t.getTeam().getName(),
                t.getTeam().getColor(),
                t.getTeam().getIcon(),
                t.getStartDate(),
                t.getEndDate()
        );
    }

    private String sanitize(String query) {
        if (query == null) return "";
        String trimmed = query.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) trimmed = trimmed.substring(0, MAX_QUERY_LENGTH);
        return trimmed;
    }
}
