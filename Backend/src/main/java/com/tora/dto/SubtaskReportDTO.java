package com.tora.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SubtaskReportDTO {
    private Long id;
    private String title;
    private boolean completed;
    private String startDate;
    private String endDate;
    private String assignee;
}
