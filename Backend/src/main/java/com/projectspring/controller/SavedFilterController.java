package com.projectspring.controller;

import com.projectspring.dto.CreateSavedFilterRequest;
import com.projectspring.dto.SavedFilterDTO;
import com.projectspring.service.SavedFilterService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/saved-filters")
public class SavedFilterController {

    @Autowired
    private SavedFilterService savedFilterService;

    @GetMapping
    public ResponseEntity<List<SavedFilterDTO>> getMyFilters() {
        return ResponseEntity.ok(savedFilterService.getMyFilters());
    }

    @PostMapping
    public ResponseEntity<SavedFilterDTO> create(@Valid @RequestBody CreateSavedFilterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(savedFilterService.create(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        savedFilterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
