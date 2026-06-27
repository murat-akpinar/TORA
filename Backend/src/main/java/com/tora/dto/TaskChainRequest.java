package com.tora.dto;

import com.tora.model.enums.Priority;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskChainRequest {
    @NotBlank(message = "Title is required")
    @Size(max = 255)
    private String title;

    private String content;

    @NotNull(message = "Target team is required")
    private Long targetTeamId;

    private Long targetProjectId;

    private Priority priority;

    @NotNull(message = "Duration days is required")
    @Min(0)
    private Integer durationDays;

    private List<Long> assigneeIds;
}
