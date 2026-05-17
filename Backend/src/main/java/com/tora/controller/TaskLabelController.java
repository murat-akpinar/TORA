package com.tora.controller;

import com.tora.dto.TaskLabelDTO;
import com.tora.service.TaskLabelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-labels")
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
