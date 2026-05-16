package com.projectspring.controller;

import com.projectspring.dto.TaskLabelDTO;
import com.projectspring.service.TaskLabelService;
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
