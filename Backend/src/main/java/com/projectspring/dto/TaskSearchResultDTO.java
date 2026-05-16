package com.projectspring.dto;

import com.projectspring.model.enums.Priority;
import com.projectspring.model.enums.TaskStatus;

import java.time.LocalDate;

public class TaskSearchResultDTO {
    private Long id;
    private String title;
    private TaskStatus status;
    private Priority priority;
    private Long teamId;
    private String teamName;
    private String teamColor;
    private String teamIcon;
    private LocalDate startDate;
    private LocalDate endDate;

    public TaskSearchResultDTO() {}

    public TaskSearchResultDTO(Long id, String title, TaskStatus status, Priority priority,
                               Long teamId, String teamName, String teamColor, String teamIcon,
                               LocalDate startDate, LocalDate endDate) {
        this.id = id;
        this.title = title;
        this.status = status;
        this.priority = priority;
        this.teamId = teamId;
        this.teamName = teamName;
        this.teamColor = teamColor;
        this.teamIcon = teamIcon;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }
    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }
    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }
    public String getTeamColor() { return teamColor; }
    public void setTeamColor(String teamColor) { this.teamColor = teamColor; }
    public String getTeamIcon() { return teamIcon; }
    public void setTeamIcon(String teamIcon) { this.teamIcon = teamIcon; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}
