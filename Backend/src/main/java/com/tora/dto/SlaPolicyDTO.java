package com.tora.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SlaPolicyDTO {
    private Long id;
    private String name;
    private String priority;       // null = any
    private Long teamId;           // null = any
    private String teamName;
    private Integer targetHours;
    private Boolean businessHoursOnly;
    private Boolean isActive;
}
