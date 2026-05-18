package com.tora.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportPerformanceDTO {
    private String period;
    private long created;
    private long completed;
    private long cancelled;
    private long inProgress;
    private long testing;
    private long open;
    private long total;
}
