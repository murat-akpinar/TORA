package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.DashboardDetailsDTO;
import com.tora.dto.DashboardStatsDTO;
import com.tora.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/teams")
@Tag(name = "Dashboard & İstatistik", description = "Birim dashboard, leaderboard ve özet metrikler")
public class DashboardController {
    
    @Autowired
    private DashboardService dashboardService;
    
    @GetMapping("/{id}/dashboard")
    public ResponseEntity<DashboardStatsDTO> getTeamDashboard(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(dashboardService.getTeamDashboardStats(id, startDate, endDate));
    }
    
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStatsDTO> getAllTeamsDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(dashboardService.getTeamDashboardStats(null, startDate, endDate));
    }
    
    @GetMapping("/{id}/dashboard/details")
    public ResponseEntity<DashboardDetailsDTO> getTeamDashboardDetails(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(dashboardService.getTeamDashboardDetails(id, startDate, endDate));
    }
    
    @GetMapping("/dashboard/details")
    public ResponseEntity<DashboardDetailsDTO> getAllTeamsDashboardDetails(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(dashboardService.getTeamDashboardDetails(null, startDate, endDate));
    }
}
