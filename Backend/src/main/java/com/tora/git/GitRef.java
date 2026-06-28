package com.tora.git;

public record GitRef(
    String linkType,
    String externalId,
    String url,
    String title,
    String status,
    String branch,
    String author,
    String authorEmail,
    String message
) {}
