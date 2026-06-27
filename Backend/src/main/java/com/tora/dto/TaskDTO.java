package com.tora.dto;

import com.tora.model.enums.TaskStatus;
import com.tora.model.enums.Priority;
import com.tora.model.enums.SlaStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskDTO {
    private Long id;
    private String code;
    private String title;
    private String content;
    private LocalDate startDate;
    private LocalDate endDate;
    private TaskStatus status;
    private Priority priority;
    private List<TaskLabelDTO> labels;
    private Long teamId;
    private String teamName;
    private String teamColor;
    private String teamIcon;
    private Long projectId;
    private String projectName;
    private Long projectManagerId;
    private Long createdById;
    private String createdByName;
    private Set<Long> assigneeIds;
    private List<String> assigneeNames;
    private List<SubtaskDTO> subtasks;
    private SlaStatus slaStatus;
    private LocalDateTime slaDueAt;
    private List<TaskChainDTO> chains;
    private Long spawnedFromTaskId;
    private String spawnedFromTitle;
    private List<TaskGitLinkDTO> gitLinks;
}
