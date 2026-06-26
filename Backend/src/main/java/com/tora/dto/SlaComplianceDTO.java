package com.tora.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SlaComplianceDTO {
    private long onTrack;
    private long atRisk;
    private long breached;
    private long met;
    private double complianceRate; // met / (met + breached) * 100
}
