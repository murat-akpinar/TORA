package com.tora.dto;

import lombok.Data;

@Data
public class UpdateGitSettingsRequest {
    private Boolean enabled;
    private String webhookSecret;
    private String mrOpenedStatus;
    private String mrMergedStatus;
    private String pushStatus;
}
