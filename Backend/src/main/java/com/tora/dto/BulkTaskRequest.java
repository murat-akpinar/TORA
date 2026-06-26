package com.tora.dto;

import com.tora.model.enums.TaskStatus;
import lombok.Data;

import java.util.List;

@Data
public class BulkTaskRequest {
    private String action;          // STATUS | ASSIGN | DELETE
    private List<Long> taskIds;
    private TaskStatus status;      // STATUS
    private String changeReason;    // STATUS
    private Long assigneeId;        // ASSIGN
}
