package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.TaskLabelDTO;
import com.tora.service.TaskLabelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-labels")
@Tag(name = "Görev Etiketleri", description = "Esnek etiket tanımları")
public class TaskLabelController {

    @Autowired
    private TaskLabelService taskLabelService;

    @GetMapping
    public ResponseEntity<List<TaskLabelDTO>> search(
            @RequestParam Long teamId,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(taskLabelService.searchLabels(teamId, search));
    }
}
