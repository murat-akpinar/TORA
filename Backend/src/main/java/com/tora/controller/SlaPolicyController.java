package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.CreateSlaPolicyRequest;
import com.tora.dto.SlaPolicyDTO;
import com.tora.service.SlaService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/sla-policies")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "SLA Politikaları", description = "SLA politika tanımları CRUD (admin)")
public class SlaPolicyController {

    @Autowired
    private SlaService slaService;

    @GetMapping
    public ResponseEntity<List<SlaPolicyDTO>> list() {
        return ResponseEntity.ok(slaService.listPolicies());
    }

    @PostMapping
    public ResponseEntity<SlaPolicyDTO> create(@Valid @RequestBody CreateSlaPolicyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(slaService.createPolicy(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SlaPolicyDTO> update(@PathVariable Long id,
                                               @Valid @RequestBody CreateSlaPolicyRequest request) {
        return ResponseEntity.ok(slaService.updatePolicy(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        slaService.deletePolicy(id);
        return ResponseEntity.noContent().build();
    }
}
