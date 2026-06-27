package com.tora.service;

import com.tora.git.*;
import com.tora.model.Task;
import com.tora.model.TaskGitLink;
import com.tora.model.User;
import com.tora.model.GitSettings;
import com.tora.repository.TaskGitLinkRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitWebhookServiceTest {

    @Test
    void extractCodes_findsMultipleCaseInsensitiveDistinct() {
        List<String> codes = GitWebhookService.extractCodes(List.of(
            "fix TORA-12 and tora-12", "ref TORA-99", "no code here"));
        assertTrue(codes.contains("TORA-12"));
        assertTrue(codes.contains("TORA-99"));
        assertEquals(2, codes.size());
    }

    @Test
    void process_disabled_returnsDisabled() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(false);
        when(settings.getActiveSettings()).thenReturn(gs);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(), mock(TaskRepository.class),
            mock(TaskGitLinkRepository.class), mock(UserRepository.class),
            mock(TaskService.class));

        var result = svc.process("github", Map.of(), new byte[0]);
        assertEquals(GitWebhookService.WebhookOutcome.DISABLED, result.outcome());
    }

    @Test
    void process_invalidSignature_returns401Outcome() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(false);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), mock(TaskRepository.class),
            mock(TaskGitLinkRepository.class), mock(UserRepository.class),
            mock(TaskService.class));

        var result = svc.process("github", Map.of(), new byte[0]);
        assertEquals(GitWebhookService.WebhookOutcome.INVALID_SIGNATURE, result.outcome());
    }

    @Test
    void process_linksCommitToMatchedTask() {
        GitSettingsService settings = mock(GitSettingsService.class);
        GitSettings gs = new GitSettings();
        gs.setIsEnabled(true);
        when(settings.getActiveSettings()).thenReturn(gs);
        when(settings.getDecryptedSecret()).thenReturn("s");

        GitWebhookParser parser = mock(GitWebhookParser.class);
        when(parser.platform()).thenReturn("github");
        when(parser.verify(any(), any(), eq("s"))).thenReturn(true);
        GitRef ref = new GitRef("COMMIT", "abc", "http://x", "TORA-12 fix", null, "feat", "Ada");
        when(parser.parse(any(), any())).thenReturn(Optional.of(
            new GitEvent("github", GitEventType.PUSH, List.of("TORA-12 fix"), List.of(ref))));

        Task task = new Task();
        task.setId(5L);
        TaskRepository taskRepo = mock(TaskRepository.class);
        when(taskRepo.findByCode("TORA-12")).thenReturn(Optional.of(task));

        TaskGitLinkRepository linkRepo = mock(TaskGitLinkRepository.class);
        when(linkRepo.findByTask_IdAndPlatformAndLinkTypeAndExternalId(5L, "github", "COMMIT", "abc"))
            .thenReturn(Optional.empty());

        UserRepository userRepo = mock(UserRepository.class);

        GitWebhookService svc = new GitWebhookService(
            settings, List.of(parser), taskRepo, linkRepo, userRepo, mock(TaskService.class));

        var result = svc.process("github", Map.of(), "{}".getBytes());
        assertEquals(GitWebhookService.WebhookOutcome.PROCESSED, result.outcome());
        assertEquals(1, result.linkedCount());
        verify(linkRepo).save(any(TaskGitLink.class));
    }
}
