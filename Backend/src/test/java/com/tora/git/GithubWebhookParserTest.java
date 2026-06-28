package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GithubWebhookParserTest {

    private final GithubWebhookParser parser = new GithubWebhookParser(new ObjectMapper());

    @Test
    void verify_validSignature() {
        byte[] body = "{\"a\":1}".getBytes();
        String sig = "sha256=" + HmacUtil.hmacSha256Hex(body, "s3cr3t");
        assertTrue(parser.verify(Map.of("x-hub-signature-256", sig), body, "s3cr3t"));
        assertFalse(parser.verify(Map.of("x-hub-signature-256", "sha256=deadbeef"), body, "s3cr3t"));
        assertFalse(parser.verify(Map.of(), body, "s3cr3t"));
    }

    @Test
    void parse_push_extractsCommitsAndMessages() {
        String body = """
            {"ref":"refs/heads/feature/TORA-12",
             "commits":[
               {"id":"abc123","message":"TORA-12 fix login","url":"http://gh/c/abc123","author":{"name":"Ada","email":"ada@firma.com"}}
             ]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("github", ev.get().platform());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-12")));
        assertEquals(1, ev.get().refs().size());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("COMMIT", ref.linkType());
        assertEquals("abc123", ref.externalId());
        assertEquals("Ada", ref.author());
        assertEquals("ada@firma.com", ref.authorEmail());
        assertEquals("TORA-12 fix login", ref.message());
    }

    @Test
    void parse_pullRequestMerged() {
        String body = """
            {"action":"closed",
             "pull_request":{"number":7,"title":"TORA-99 add panel","body":"closes TORA-99",
               "html_url":"http://gh/pr/7","merged":true,
               "head":{"ref":"feature/x"},"user":{"login":"bob"}}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "pull_request"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_MERGED, ev.get().type());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("MR", ref.linkType());
        assertEquals("7", ref.externalId());
        assertEquals("MERGED", ref.status());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-99")));
    }

    @Test
    void parse_createBranch_returnsBranchCreated() {
        String body = """
            {"ref":"TORA-1148","ref_type":"branch"}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "create"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1148")));
        assertTrue(ev.get().refs().isEmpty());
    }

    @Test
    void parse_createTag_empty() {
        String body = """
            {"ref":"v1.0","ref_type":"tag"}
            """;
        assertTrue(parser.parse(Map.of("x-github-event", "create"), body).isEmpty());
    }

    @Test
    void parse_pushNewBranch_zeroBefore_returnsBranchCreated() {
        String body = """
            {"ref":"refs/heads/TORA-1178",
             "before":"0000000000000000000000000000000000000000",
             "commits":[]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-github-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1178")));
    }

    @Test
    void parse_unknownEvent_empty() {
        assertTrue(parser.parse(Map.of("x-github-event", "issues"), "{}").isEmpty());
    }
}
