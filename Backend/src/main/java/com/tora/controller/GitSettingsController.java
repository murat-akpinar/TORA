package com.tora.controller;

import com.tora.dto.GitSettingsDTO;
import com.tora.dto.UpdateGitSettingsRequest;
import com.tora.service.GitSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/git/settings")
@PreAuthorize("hasAnyRole('ADMIN')")
public class GitSettingsController {

    private final GitSettingsService service;

    public GitSettingsController(GitSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<GitSettingsDTO> get() {
        return ResponseEntity.ok(service.getSettings());
    }

    @PutMapping
    public ResponseEntity<GitSettingsDTO> update(@RequestBody UpdateGitSettingsRequest request) {
        return ResponseEntity.ok(service.updateSettings(request));
    }
}
