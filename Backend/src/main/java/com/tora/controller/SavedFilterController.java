package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.CreateSavedFilterRequest;
import com.tora.dto.SavedFilterDTO;
import com.tora.service.SavedFilterService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/saved-filters")
@Tag(name = "Kaydedilmiş Filtreler", description = "Kullanıcının kaydettiği görev filtreleri")
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
