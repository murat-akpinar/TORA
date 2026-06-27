package com.tora.dto;

import com.tora.model.enums.Priority;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskChainDTO {
    private Long id;
    private String title;
    private String content;
    private Long targetTeamId;
    private String targetTeamName;
    private Long targetProjectId;
    private Priority priority;
    private Integer durationDays;
    private List<Long> assigneeIds;
    private LocalDateTime triggeredAt;
}
