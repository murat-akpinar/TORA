package com.tora.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateSavedFilterRequest {

    @NotBlank
    @Size(min = 1, max = 100)
    private String name;

    @NotBlank
    private String filterJson;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getFilterJson() { return filterJson; }
    public void setFilterJson(String filterJson) { this.filterJson = filterJson; }
}
