package com.tora.dto;

import lombok.Data;

@Data
public class TaskGitLinkDTO {
    private Long id;
    private String platform;
    private String linkType;
    private String externalId;
    private String url;
    private String title;
    private String status;
    private String branch;
    private String author;
}
