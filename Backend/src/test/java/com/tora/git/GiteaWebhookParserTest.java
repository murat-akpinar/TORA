package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GiteaWebhookParserTest {

    private final GiteaWebhookParser parser = new GiteaWebhookParser(new ObjectMapper());

    @Test
    void verify_hexSignature() {
        byte[] body = "{\"a\":1}".getBytes();
        String sig = HmacUtil.hmacSha256Hex(body, "k");
        assertTrue(parser.verify(Map.of("x-gitea-signature", sig), body, "k"));
        assertFalse(parser.verify(Map.of("x-gitea-signature", "00"), body, "k"));
    }

    @Test
    void parse_push() {
        String body = """
            {"ref":"refs/heads/TORA-3",
             "commits":[{"id":"c1","message":"TORA-3 init","url":"http://gt/c1","author":{"name":"Mo","email":"ada@firma.com"}}]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("c1", ev.get().refs().get(0).externalId());
        assertEquals("ada@firma.com", ev.get().refs().get(0).authorEmail());
    }

    @Test
    void parse_pullRequestOpened() {
        String body = """
            {"action":"opened",
             "number":3,
             "pull_request":{"title":"TORA-8 x","body":"b","html_url":"http://gt/pr/3",
               "merged":false,"head":{"ref":"feat"},"user":{"login":"mo"}}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "pull_request"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_OPENED, ev.get().type());
        assertEquals("3", ev.get().refs().get(0).externalId());
        assertEquals("OPENED", ev.get().refs().get(0).status());
    }

    @Test
    void parse_createBranch_returnsBranchCreated() {
        String body = """
            {"ref":"TORA-1148","ref_type":"branch"}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "create"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1148")));
        assertTrue(ev.get().refs().isEmpty());
    }

    @Test
    void parse_pushNewBranch_zeroBefore_returnsBranchCreated() {
        // Gitea yeni branch'i create yerine push (before=sifirlar, commits bos) olarak da gonderir
        String body = """
            {"ref":"refs/heads/TORA-1178",
             "before":"0000000000000000000000000000000000000000",
             "commits":[]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitea-event", "push"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.BRANCH_CREATED, ev.get().type());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-1178")));
    }
}
