package com.tora.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateSlaPolicyRequest {
    @NotBlank
    private String name;
    private String priority;       // null = any (URGENT/HIGH/NORMAL)
    private Long teamId;           // null = any
    @NotNull
    @Min(1)
    private Integer targetHours;
    private Boolean businessHoursOnly = false;
    private Boolean isActive = true;
}
