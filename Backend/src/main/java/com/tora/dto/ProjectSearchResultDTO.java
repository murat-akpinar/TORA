package com.tora.dto;

import com.tora.model.enums.ProjectStatus;

public class ProjectSearchResultDTO {
    private Long id;
    private String name;
    private String description;
    private ProjectStatus status;

    public ProjectSearchResultDTO() {}

    public ProjectSearchResultDTO(Long id, String name, String description, ProjectStatus status) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.status = status;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ProjectStatus getStatus() { return status; }
    public void setStatus(ProjectStatus status) { this.status = status; }
}
