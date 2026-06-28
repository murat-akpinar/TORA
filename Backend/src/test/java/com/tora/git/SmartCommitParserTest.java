package com.tora.git;

import com.tora.model.enums.TaskStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SmartCommitParserTest {

    private final SmartCommitParser parser = new SmartCommitParser();

    @Test
    void parse_doneAlias_returnsCompletedStatus() {
        List<SmartCommand> cmds = parser.parse("TORA-42 #done isi bitirdim");
        assertEquals(1, cmds.size());
        assertEquals(SmartCommand.Kind.STATUS, cmds.get(0).kind());
        assertEquals(TaskStatus.COMPLETED, cmds.get(0).status());
    }

    @Test
    void parse_turkishAndEnglishAliases() {
        assertEquals(TaskStatus.COMPLETED, parser.parse("#kapat").get(0).status());
        assertEquals(TaskStatus.IN_PROGRESS, parser.parse("#progress").get(0).status());
        assertEquals(TaskStatus.IN_PROGRESS, parser.parse("#basla").get(0).status());
        assertEquals(TaskStatus.TESTING, parser.parse("#test").get(0).status());
        assertEquals(TaskStatus.CANCELLED, parser.parse("#iptal").get(0).status());
        assertEquals(TaskStatus.OPEN, parser.parse("#reopen").get(0).status());
    }

    @Test
    void parse_caseInsensitive() {
        assertEquals(TaskStatus.COMPLETED, parser.parse("#DONE").get(0).status());
    }

    @Test
    void parse_comment_capturesTextUntilNextHashOrEol() {
        List<SmartCommand> cmds = parser.parse("#comment review bekliyor #done");
        assertEquals(2, cmds.size());
        SmartCommand comment = cmds.stream().filter(c -> c.kind() == SmartCommand.Kind.COMMENT).findFirst().orElseThrow();
        assertEquals("review bekliyor", comment.text());
        assertTrue(cmds.stream().anyMatch(c -> c.kind() == SmartCommand.Kind.STATUS && c.status() == TaskStatus.COMPLETED));
    }

    @Test
    void parse_emptyComment_ignored() {
        List<SmartCommand> cmds = parser.parse("#comment   ");
        assertTrue(cmds.isEmpty());
    }

    @Test
    void parse_unknownCommand_ignored() {
        assertTrue(parser.parse("#frobnicate something").isEmpty());
    }

    @Test
    void parse_noCommand_empty() {
        assertTrue(parser.parse("TORA-42 normal commit mesaji").isEmpty());
        assertTrue(parser.parse(null).isEmpty());
    }

    @Test
    void parse_multipleStatusCommands_allReturned() {
        List<SmartCommand> cmds = parser.parse("#progress #test");
        assertEquals(2, cmds.size());
    }
}
