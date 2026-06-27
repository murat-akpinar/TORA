package com.tora.service;

import com.tora.git.GitEvent;
import com.tora.git.GitRef;
import com.tora.git.GitWebhookParser;
import com.tora.model.GitSettings;
import com.tora.model.Task;
import com.tora.model.TaskGitLink;
import com.tora.model.enums.TaskStatus;
import com.tora.model.User;
import com.tora.repository.TaskGitLinkRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GitWebhookService {

    private static final Logger log = LoggerFactory.getLogger(GitWebhookService.class);
    private static final Pattern CODE_PATTERN = Pattern.compile("TORA-\\d+", Pattern.CASE_INSENSITIVE);
    private static final String SYSTEM_USERNAME = "git-otomasyonu";

    public enum WebhookOutcome { DISABLED, UNKNOWN_PLATFORM, INVALID_SIGNATURE, IGNORED, PROCESSED }
    public record WebhookResult(WebhookOutcome outcome, int linkedCount) {}

    private final GitSettingsService gitSettingsService;
    private final Map<String, GitWebhookParser> parsers = new HashMap<>();
    private final TaskRepository taskRepository;
    private final TaskGitLinkRepository linkRepository;
    private final UserRepository userRepository;
    private final TaskService taskService;

    public GitWebhookService(GitSettingsService gitSettingsService,
                             List<GitWebhookParser> parserList,
                             TaskRepository taskRepository,
                             TaskGitLinkRepository linkRepository,
                             UserRepository userRepository,
                             TaskService taskService) {
        this.gitSettingsService = gitSettingsService;
        this.taskRepository = taskRepository;
        this.linkRepository = linkRepository;
        this.userRepository = userRepository;
        this.taskService = taskService;
        for (GitWebhookParser p : parserList) {
            this.parsers.put(p.platform(), p);
        }
    }

    @Transactional
    public WebhookResult process(String platform, Map<String, String> headers, byte[] rawBody) {
        GitSettings settings = gitSettingsService.getActiveSettings();
        if (!Boolean.TRUE.equals(settings.getIsEnabled())) {
            return new WebhookResult(WebhookOutcome.DISABLED, 0);
        }
        GitWebhookParser parser = parsers.get(platform);
        if (parser == null) {
            return new WebhookResult(WebhookOutcome.UNKNOWN_PLATFORM, 0);
        }
        String secret = gitSettingsService.getDecryptedSecret();
        if (secret == null || !parser.verify(headers, rawBody, secret)) {
            return new WebhookResult(WebhookOutcome.INVALID_SIGNATURE, 0);
        }
        Optional<GitEvent> parsed = parser.parse(headers, new String(rawBody, java.nio.charset.StandardCharsets.UTF_8));
        if (parsed.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }
        GitEvent event = parsed.get();
        List<String> codes = extractCodes(event.codeTexts());
        if (codes.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }

        List<Task> matchedTasks = new ArrayList<>();
        for (String code : codes) {
            Optional<Task> t = taskRepository.findByCode(code);
            if (t.isPresent()) {
                matchedTasks.add(t.get());
            } else {
                log.debug("Git webhook: eslesen gorev yok, kod={}", code);
            }
        }
        if (matchedTasks.isEmpty()) {
            return new WebhookResult(WebhookOutcome.IGNORED, 0);
        }

        int linked = 0;
        for (Task task : matchedTasks) {
            for (GitRef ref : event.refs()) {
                upsertLink(task, event.platform(), ref);
                linked++;
            }
        }
        applyStatusSync(event, settings, matchedTasks);
        return new WebhookResult(WebhookOutcome.PROCESSED, linked);
    }

    private void upsertLink(Task task, String platform, GitRef ref) {
        TaskGitLink link = linkRepository
            .findByTask_IdAndPlatformAndLinkTypeAndExternalId(
                task.getId(), platform, ref.linkType(), ref.externalId())
            .orElseGet(TaskGitLink::new);
        link.setTask(task);
        link.setPlatform(platform);
        link.setLinkType(ref.linkType());
        link.setExternalId(ref.externalId());
        link.setUrl(ref.url());
        link.setTitle(ref.title());
        link.setStatus(ref.status());
        link.setBranch(ref.branch());
        link.setAuthor(ref.author());
        linkRepository.save(link);
    }

    private void applyStatusSync(GitEvent event, GitSettings settings, List<Task> tasks) {
        String target = switch (event.type()) {
            case MR_OPENED -> settings.getMrOpenedStatus();
            case MR_MERGED -> settings.getMrMergedStatus();
            case PUSH -> settings.getPushStatus();
            case MR_CLOSED -> null;
        };
        if (target == null || target.isBlank()) return;

        TaskStatus newStatus;
        try {
            newStatus = TaskStatus.valueOf(target);
        } catch (IllegalArgumentException e) {
            log.warn("Git webhook: gecersiz durum ayari '{}'", target);
            return;
        }
        User actor = resolveGitActor(event);
        if (actor == null) {
            log.warn("Git webhook: sistem kullanicisi '{}' bulunamadi, durum senkronu atlandi", SYSTEM_USERNAME);
            return;
        }
        for (Task task : tasks) {
            if (task.getStatus() == newStatus) continue;
            try {
                taskService.updateTaskStatusAsSystem(task.getId(), newStatus, actor);
            } catch (Exception ex) {
                log.warn("Git webhook: gorev {} durum senkronu basarisiz: {}", task.getId(), ex.getMessage());
            }
        }
    }

    // Ileride email-esleme buraya: event.refs()[].author → User. Simdilik sistem kullanicisi.
    private User resolveGitActor(GitEvent event) {
        return userRepository.findByUsername(SYSTEM_USERNAME).orElse(null);
    }

    public static List<String> extractCodes(Collection<String> texts) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (texts == null) return new ArrayList<>();
        for (String t : texts) {
            if (t == null) continue;
            Matcher m = CODE_PATTERN.matcher(t);
            while (m.find()) {
                out.add(m.group().toUpperCase());
            }
        }
        return new ArrayList<>(out);
    }
}
