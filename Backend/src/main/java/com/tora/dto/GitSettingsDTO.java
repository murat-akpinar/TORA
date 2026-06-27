package com.tora.dto;

import lombok.Data;

@Data
public class GitSettingsDTO {
    private boolean enabled;
    private boolean secretConfigured;
    private String mrOpenedStatus;
    private String mrMergedStatus;
    private String pushStatus;
}
