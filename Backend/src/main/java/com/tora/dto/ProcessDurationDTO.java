package com.tora.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDurationDTO {
    private double avgDaysToComplete;
    private double minDays;
    private double maxDays;
    private long completedCount;
    private List<ProcessDurationItemDTO> byPriority;
    private List<ProcessDurationItemDTO> byTeam;
}
