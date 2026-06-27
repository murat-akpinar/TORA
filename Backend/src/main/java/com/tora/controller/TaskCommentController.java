package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.TaskCommentDTO;
import com.tora.dto.TaskCommentRequest;
import com.tora.service.TaskCommentService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Görev Yorumları", description = "Görev yorumları ve @mention")
public class TaskCommentController {

    @Autowired
    private TaskCommentService commentService;

    @GetMapping("/tasks/{taskId}/comments")
    public ResponseEntity<List<TaskCommentDTO>> listComments(@PathVariable Long taskId) {
        return ResponseEntity.ok(commentService.getCommentsForTask(taskId));
    }

    @PostMapping("/tasks/{taskId}/comments")
    public ResponseEntity<TaskCommentDTO> addComment(
            @PathVariable Long taskId,
            @Valid @RequestBody TaskCommentRequest request) {
        return ResponseEntity.ok(commentService.createComment(taskId, request));
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<TaskCommentDTO> updateComment(
            @PathVariable Long commentId,
            @Valid @RequestBody TaskCommentRequest request) {
        return ResponseEntity.ok(commentService.updateComment(commentId, request));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId) {
        commentService.deleteComment(commentId);
        return ResponseEntity.noContent().build();
    }
}
