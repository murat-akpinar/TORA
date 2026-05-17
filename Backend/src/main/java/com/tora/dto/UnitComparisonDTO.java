package com.tora.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UnitComparisonDTO {
    private Long teamId;
    private String teamName;
    private String teamColor;
    private String teamIcon;
    private long total;
    private long completed;
    private long open;
    private long inProgress;
    private long testing;
    private long cancelled;
    private double completionRate;
}
