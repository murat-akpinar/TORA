package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.*;
import com.tora.service.ReportService;
import com.tora.service.SlaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Raporlar", description = "Performans, birim karşılaştırma, Excel/PDF export")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private SlaService slaService;

    @GetMapping("/sla")
    public ResponseEntity<SlaComplianceDTO> getSlaCompliance(@RequestParam(required = false) Long teamId) {
        return ResponseEntity.ok(slaService.getCompliance(teamId));
    }

    @GetMapping("/performance")
    public ResponseEntity<List<ReportPerformanceDTO>> getPerformance(
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "monthly") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getPerformanceReport(teamId, period, startDate, endDate));
    }

    @GetMapping("/unit-comparison")
    public ResponseEntity<List<UnitComparisonDTO>> getUnitComparison(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getUnitComparison(startDate, endDate));
    }

    @GetMapping("/productivity")
    public ResponseEntity<List<UserProductivityDTO>> getProductivity(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getUserProductivity(teamId, startDate, endDate));
    }

    @GetMapping("/process-duration")
    public ResponseEntity<ProcessDurationDTO> getProcessDuration(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getProcessDuration(teamId, startDate, endDate));
    }

    @GetMapping("/task-list")
    public ResponseEntity<List<TaskListReportDTO>> getTaskList(
            @RequestParam(required = false) Long teamId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(reportService.getTaskListData(teamId, startDate, endDate));
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(defaultValue = "performance") String type,
            @RequestParam(required = false) Long teamId,
            @RequestParam(defaultValue = "monthly") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) throws IOException {
        byte[] bytes = reportService.exportToExcel(type, teamId, period, startDate, endDate);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "rapor-" + type + ".xlsx");
        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}
