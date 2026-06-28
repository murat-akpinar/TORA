package com.tora.git;

import com.tora.model.enums.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class SmartCommitParser {

    // Komut: # ile baslar, kelime; comment komutu metni sonraki # veya satir sonuna kadar alir.
    private static final Pattern TOKEN = Pattern.compile("#([A-Za-z]+)");

    private static final Map<String, TaskStatus> STATUS_ALIASES = Map.ofEntries(
        Map.entry("done", TaskStatus.COMPLETED),
        Map.entry("close", TaskStatus.COMPLETED),
        Map.entry("tamam", TaskStatus.COMPLETED),
        Map.entry("kapat", TaskStatus.COMPLETED),
        Map.entry("progress", TaskStatus.IN_PROGRESS),
        Map.entry("wip", TaskStatus.IN_PROGRESS),
        Map.entry("basla", TaskStatus.IN_PROGRESS),
        Map.entry("test", TaskStatus.TESTING),
        Map.entry("testing", TaskStatus.TESTING),
        Map.entry("cancel", TaskStatus.CANCELLED),
        Map.entry("iptal", TaskStatus.CANCELLED),
        Map.entry("reopen", TaskStatus.OPEN),
        Map.entry("open", TaskStatus.OPEN),
        Map.entry("ac", TaskStatus.OPEN)
    );

    private static final java.util.Set<String> COMMENT_KEYWORDS = java.util.Set.of("comment", "yorum");

    public List<SmartCommand> parse(String text) {
        List<SmartCommand> out = new ArrayList<>();
        if (text == null || text.isBlank()) return out;

        Matcher m = TOKEN.matcher(text);
        while (m.find()) {
            String keyword = m.group(1).toLowerCase();
            TaskStatus status = STATUS_ALIASES.get(keyword);
            if (status != null) {
                out.add(SmartCommand.status(status));
            } else if (COMMENT_KEYWORDS.contains(keyword)) {
                String body = captureCommentBody(text, m.end());
                if (!body.isBlank()) {
                    out.add(SmartCommand.comment(body.trim()));
                }
            }
            // bilinmeyen komut: yok say
        }
        return out;
    }

    // Komut sonundan, sonraki '#' veya satir sonuna kadar olan metni doner.
    private String captureCommentBody(String text, int from) {
        int end = text.length();
        for (int i = from; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '#' || ch == '\n' || ch == '\r') { end = i; break; }
        }
        return text.substring(from, end);
    }
}
