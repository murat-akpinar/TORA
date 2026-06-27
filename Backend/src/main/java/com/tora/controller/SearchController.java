package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.SearchResultDTO;
import com.tora.service.SearchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
@Tag(name = "Arama", description = "Global full-text arama (görev/proje/kullanıcı)")
public class SearchController {

    @Autowired
    private SearchService searchService;

    @GetMapping
    public ResponseEntity<SearchResultDTO> search(@RequestParam(value = "q", defaultValue = "") String query) {
        return ResponseEntity.ok(searchService.search(query));
    }
}
