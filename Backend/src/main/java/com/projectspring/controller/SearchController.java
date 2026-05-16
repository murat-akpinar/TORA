package com.projectspring.controller;

import com.projectspring.dto.SearchResultDTO;
import com.projectspring.service.SearchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    @Autowired
    private SearchService searchService;

    @GetMapping
    public ResponseEntity<SearchResultDTO> search(@RequestParam(value = "q", defaultValue = "") String query) {
        return ResponseEntity.ok(searchService.search(query));
    }
}
