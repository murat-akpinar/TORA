package com.tora.controller;

import com.tora.service.GitWebhookService;
import com.tora.service.GitWebhookService.WebhookResult;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/webhooks/git")
public class GitWebhookController {

    private final GitWebhookService service;

    public GitWebhookController(GitWebhookService service) {
        this.service = service;
    }

    @PostMapping("/{platform}")
    public ResponseEntity<Map<String, Object>> receive(
            @PathVariable String platform,
            @RequestBody(required = false) byte[] rawBody,
            HttpServletRequest request) {

        Map<String, String> headers = new HashMap<>();
        var names = request.getHeaderNames();
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            headers.put(name.toLowerCase(), request.getHeader(name));
        }

        WebhookResult result = service.process(
            platform, headers, rawBody == null ? new byte[0] : rawBody);

        return switch (result.outcome()) {
            case INVALID_SIGNATURE -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("status", "invalid_signature"));
            case UNKNOWN_PLATFORM -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("status", "unknown_platform"));
            case DISABLED -> ResponseEntity.ok(Map.of("status", "disabled"));
            case IGNORED -> ResponseEntity.ok(Map.of("status", "ignored"));
            case PROCESSED -> ResponseEntity.ok(Map.of(
                "status", "processed", "linked", result.linkedCount()));
        };
    }
}
