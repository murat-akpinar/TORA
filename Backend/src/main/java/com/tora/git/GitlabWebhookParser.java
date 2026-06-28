package com.tora.git;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class GitlabWebhookParser implements GitWebhookParser {

    private final ObjectMapper mapper;

    public GitlabWebhookParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public String platform() {
        return "gitlab";
    }

    @Override
    public boolean verify(Map<String, String> headers, byte[] rawBody, String secret) {
        return HmacUtil.constantTimeEquals(headers.get("x-gitlab-token"), secret);
    }

    @Override
    public Optional<GitEvent> parse(Map<String, String> headers, String body) {
        try {
            String event = headers.getOrDefault("x-gitlab-event", "");
            JsonNode root = mapper.readTree(body);
            if ("Push Hook".equals(event)) return parsePush(root);
            if ("Merge Request Hook".equals(event)) return parseMr(root);
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
        return Optional.of(new GitEvent("gitlab", GitEventType.PUSH, texts, refs));
    }

    private Optional<GitEvent> parseMr(JsonNode root) {
        JsonNode oa = root.path("object_attributes");
        String action = oa.path("action").asText("");
        GitEventType type;
        String status;
        switch (action) {
            case "open", "reopen" -> { type = GitEventType.MR_OPENED; status = "OPENED"; }
            case "merge" -> { type = GitEventType.MR_MERGED; status = "MERGED"; }
            case "close" -> { type = GitEventType.MR_CLOSED; status = "CLOSED"; }
            default -> { return Optional.empty(); }
        }
        String branch = oa.path("source_branch").asText("");
        List<String> texts = List.of(
            oa.path("title").asText(""),
            oa.path("description").asText(""),
            branch);
        GitRef ref = new GitRef("MR",
            oa.path("iid").asText(""),
            oa.path("url").asText(""),
            oa.path("title").asText(""),
            status, branch,
            root.path("user").path("username").asText(""),
            null,
            oa.path("title").asText("") + "\n" + oa.path("description").asText(""));
        return Optional.of(new GitEvent("gitlab", type, texts, List.of(ref)));
    }

    private String stripRef(String ref) {
        return ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : ref;
    }

    private String firstLine(String s) {
        int nl = s.indexOf('\n');
        return nl >= 0 ? s.substring(0, nl) : s;
    }
}
