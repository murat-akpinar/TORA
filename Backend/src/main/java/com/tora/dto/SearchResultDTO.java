package com.tora.dto;

import java.util.List;

public class SearchResultDTO {
    private List<TaskSearchResultDTO> tasks;
    private List<ProjectSearchResultDTO> projects;
    private List<UserSearchResultDTO> users;

    public SearchResultDTO() {}

    public SearchResultDTO(List<TaskSearchResultDTO> tasks,
                           List<ProjectSearchResultDTO> projects,
                           List<UserSearchResultDTO> users) {
        this.tasks = tasks;
        this.projects = projects;
        this.users = users;
    }

    public List<TaskSearchResultDTO> getTasks() { return tasks; }
    public void setTasks(List<TaskSearchResultDTO> tasks) { this.tasks = tasks; }
    public List<ProjectSearchResultDTO> getProjects() { return projects; }
    public void setProjects(List<ProjectSearchResultDTO> projects) { this.projects = projects; }
    public List<UserSearchResultDTO> getUsers() { return users; }
    public void setUsers(List<UserSearchResultDTO> users) { this.users = users; }
}
