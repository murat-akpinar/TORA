package com.tora.dto;

import com.tora.model.enums.TaskStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTaskStatusRequest {
    @NotNull(message = "Status is required")
    private TaskStatus status;

    private String changeReason;
}
