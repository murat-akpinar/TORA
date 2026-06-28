package com.tora.git;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GiteaWebhookParser implements GitWebhookParser {

    private final ObjectMapper mapper;

    public GiteaWebhookParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public String platform() {
        return "gitea";
    }

    @Override
    public boolean verify(Map<String, String> headers, byte[] rawBody, String secret) {
        String header = headers.get("x-gitea-signature");
        if (header == null) return false;
        return HmacUtil.constantTimeEquals(header, HmacUtil.hmacSha256Hex(rawBody, secret));
    }

    @Override
    public Optional<GitEvent> parse(Map<String, String> headers, String body) {
        try {
            String event = headers.getOrDefault("x-gitea-event", "");
            JsonNode root = mapper.readTree(body);
            if ("push".equals(event)) return parsePush(root);
            if ("pull_request".equals(event)) return parsePullRequest(root);
            if ("create".equals(event)) return parseCreate("gitea", root);
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<GitEvent> parsePush(JsonNode root) {
        List<String> texts = new ArrayList<>();
        List<GitRef> refs = new ArrayList<>();
        String branch = stripRef(root.path("ref").asText(""));
        if (!branch.isBlank()) texts.add(branch);
        for (JsonNode c : root.path("commits")) {
            String msg = c.path("message").asText("");
            texts.add(msg);
            refs.add(new GitRef("COMMIT",
                c.path("id").asText(""),
                c.path("url").asText(""),
                firstLine(msg),
                null, branch,
                c.path("author").path("name").asText(""),
                c.path("author").path("email").asText(""),
                msg));
        }
        return Optional.of(new GitEvent("gitea", GitEventType.PUSH, texts, refs));
    }

    private Optional<GitEvent> parsePullRequest(JsonNode root) {
        String action = root.path("action").asText("");
        JsonNode pr = root.path("pull_request");
        GitEventType type;
        String status;
        if ("opened".equals(action) || "reopened".equals(action)) {
            type = GitEventType.MR_OPENED; status = "OPENED";
        } else if ("closed".equals(action) && pr.path("merged").asBoolean(false)) {
            type = GitEventType.MR_MERGED; status = "MERGED";
        } else if ("closed".equals(action)) {
            type = GitEventType.MR_CLOSED; status = "CLOSED";
        } else {
            return Optional.empty();
        }
        String branch = pr.path("head").path("ref").asText("");
        List<String> texts = List.of(
            pr.path("title").asText(""),
            pr.path("body").asText(""),
            branch);
        GitRef ref = new GitRef("MR",
            root.path("number").asText(pr.path("number").asText("")),
            pr.path("html_url").asText(""),
            pr.path("title").asText(""),
            status, branch,
            pr.path("user").path("login").asText(""),
            null,
            pr.path("title").asText("") + "\n" + pr.path("body").asText(""));
        return Optional.of(new GitEvent("gitea", type, texts, List.of(ref)));
    }

    private Optional<GitEvent> parseCreate(String platform, JsonNode root) {
        if (!"branch".equals(root.path("ref_type").asText(""))) return Optional.empty();
        String branch = root.path("ref").asText("");
        return Optional.of(new GitEvent(platform, GitEventType.BRANCH_CREATED, List.of(branch), List.of()));
    }

    private String stripRef(String ref) {
        return ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
    }

    private String firstLine(String s) {
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}
