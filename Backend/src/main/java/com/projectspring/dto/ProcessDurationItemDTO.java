package com.projectspring.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessDurationItemDTO {
    private String label;
    private double avgDays;
    private long count;
}
