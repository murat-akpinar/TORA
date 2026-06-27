package com.tora.git;

import java.util.Map;
import java.util.Optional;

public interface GitWebhookParser {
    String platform();
    boolean verify(Map<String, String> headers, byte[] rawBody, String secret);
    Optional<GitEvent> parse(Map<String, String> headers, String body);
}
