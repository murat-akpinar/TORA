package com.projectspring.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskListReportDTO {
    private Long id;
    private String title;
    private String teamName;
    private String projectName;
    private String priority;
    private String status;
    private String startDate;
    private String endDate;
    private String assignees;
    private int subtaskTotal;
    private int subtaskCompleted;
    private List<SubtaskReportDTO> subtasks;
}
