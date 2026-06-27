package com.tora.git;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class GitlabWebhookParserTest {

    private final GitlabWebhookParser parser = new GitlabWebhookParser(new ObjectMapper());

    @Test
    void verify_tokenEquality() {
        assertTrue(parser.verify(Map.of("x-gitlab-token", "tok"), new byte[0], "tok"));
        assertFalse(parser.verify(Map.of("x-gitlab-token", "nope"), new byte[0], "tok"));
        assertFalse(parser.verify(Map.of(), new byte[0], "tok"));
    }

    @Test
    void parse_push() {
        String body = """
            {"ref":"refs/heads/TORA-5",
             "commits":[{"id":"sha1","message":"TORA-5 wip","url":"http://gl/c/sha1","author":{"name":"Lia"}}]}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitlab-event", "Push Hook"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.PUSH, ev.get().type());
        assertEquals("sha1", ev.get().refs().get(0).externalId());
        assertTrue(ev.get().codeTexts().stream().anyMatch(t -> t.contains("TORA-5")));
    }

    @Test
    void parse_mergeRequestMerged() {
        String body = """
            {"object_attributes":{"iid":42,"action":"merge","title":"TORA-7 done",
              "description":"x","url":"http://gl/mr/42","source_branch":"feat","state":"merged"},
             "user":{"username":"lia"}}
            """;
        Optional<GitEvent> ev = parser.parse(Map.of("x-gitlab-event", "Merge Request Hook"), body);
        assertTrue(ev.isPresent());
        assertEquals(GitEventType.MR_MERGED, ev.get().type());
        GitRef ref = ev.get().refs().get(0);
        assertEquals("MR", ref.linkType());
        assertEquals("42", ref.externalId());
        assertEquals("MERGED", ref.status());
    }

    @Test
    void parse_unknown_empty() {
        assertTrue(parser.parse(Map.of("x-gitlab-event", "Note Hook"), "{}").isEmpty());
    }
}
