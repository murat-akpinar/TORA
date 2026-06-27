package com.tora.dto;

import com.tora.model.enums.TaskStatus;
import com.tora.model.enums.Priority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTaskRequest {
    @NotBlank(message = "Title is required")
    private String title;
    
    private String content;
    
    @NotNull(message = "Start date is required")
    private LocalDate startDate;
    
    @NotNull(message = "End date is required")
    private LocalDate endDate;
    
    private TaskStatus status = TaskStatus.OPEN;

    private Priority priority = Priority.NORMAL;

    private List<Long> labelIds;

    private List<String> newLabelNames;
    
    @NotNull(message = "Team ID is required")
    private Long teamId;
    
    private Long projectId;
    
    private Set<Long> assigneeIds;
    
    private List<CreateSubtaskRequest> subtasks;

    // Tamamlanınca otomatik açılacak takip görevleri (zincir)
    @jakarta.validation.Valid
    private List<TaskChainRequest> chains;
}

