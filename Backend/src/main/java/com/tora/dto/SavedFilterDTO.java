package com.tora.dto;

import java.time.LocalDateTime;

public class SavedFilterDTO {
    private Long id;
    private String name;
    private String filterJson;
    private LocalDateTime createdAt;

    public SavedFilterDTO() {}

    public SavedFilterDTO(Long id, String name, String filterJson, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.filterJson = filterJson;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFilterJson() { return filterJson; }
    public void setFilterJson(String filterJson) { this.filterJson = filterJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
