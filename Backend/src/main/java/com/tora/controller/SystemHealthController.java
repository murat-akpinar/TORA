package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.SystemHealthDTO;
import com.tora.service.SystemHealthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/health")
@PreAuthorize("hasAnyRole('ADMIN', 'BIRIM_AMIRI')")
@Tag(name = "Sistem Sağlığı (Admin)", description = "Sistem sağlık metrikleri (admin/birim amiri)")
public class SystemHealthController {

    @Autowired
    private SystemHealthService systemHealthService;

    @GetMapping
    public ResponseEntity<SystemHealthDTO> getSystemHealth() {
        return ResponseEntity.ok(systemHealthService.checkSystemHealth());
    }
}

