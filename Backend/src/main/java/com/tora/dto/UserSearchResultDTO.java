package com.tora.dto;

import java.util.List;

public class UserSearchResultDTO {
    private Long id;
    private String fullName;
    private String username;
    private List<String> roles;

    public UserSearchResultDTO() {}

    public UserSearchResultDTO(Long id, String fullName, String username, List<String> roles) {
        this.id = id;
        this.fullName = fullName;
        this.username = username;
        this.roles = roles;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public List<String> getRoles() { return roles; }
    public void setRoles(List<String> roles) { this.roles = roles; }
}
