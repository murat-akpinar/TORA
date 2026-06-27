package com.tora.service;

import com.tora.dto.TaskChainRequest;
import com.tora.model.*;
import com.tora.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskChainServiceTest {

    @Mock TaskChainRepository taskChainRepository;
    @Mock TeamRepository teamRepository;
    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @Mock TaskRepository taskRepository;
    @Mock SlaService slaService;
    @Mock TaskLogService taskLogService;
    @Mock NotificationService notificationService;
    @Mock org.springframework.cache.CacheManager cacheManager;

    @InjectMocks TaskChainService service;

    private Task source() {
        Task t = new Task();
        t.setId(1L);
        t.setChains(new ArrayList<>());
        return t;
    }

    // ───────────────── upsertChains ─────────────────
    @Test
    void upsertChains_createsNewDefinition() {
        Task source = source();
        Team team = new Team(); team.setId(5L);
        when(teamRepository.findById(5L)).thenReturn(Optional.of(team));

        TaskChainRequest req = new TaskChainRequest();
        req.setTitle("İzleme kur");
        req.setTargetTeamId(5L);
        req.setDurationDays(3);

        service.upsertChains(source, List.of(req));

        assertThat(source.getChains()).hasSize(1);
        TaskChain c = source.getChains().iterator().next();
        assertThat(c.getTitle()).isEqualTo("İzleme kur");
        assertThat(c.getTargetTeam()).isEqualTo(team);
        assertThat(c.getDurationDays()).isEqualTo(3);
    }

    @Test
    void upsertChains_nullOrEmpty_clearsExisting() {
        Task source = source();
        source.getChains().add(new TaskChain());

        service.upsertChains(source, null);

        assertThat(source.getChains()).isEmpty();
    }

    // ───────────────── fireIfDefined ─────────────────
    @Test
    void fireIfDefined_createsFollowUp_withRelativeDatesAndCompleterAsCreator() {
        Task source = source();
        Team team = new Team(); team.setId(9L);
        User completer = new User(); completer.setId(77L);

        TaskChain c = new TaskChain();
        c.setSource(source); c.setTitle("Network bilgilendir");
        c.setTargetTeam(team); c.setDurationDays(2);
        c.setAssignees(new HashSet<>());
        source.getChains().add(c);

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        service.fireIfDefined(source, completer);

        ArgumentCaptor<Task> cap = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(cap.capture());
        Task created = cap.getValue();
        assertThat(created.getTitle()).isEqualTo("Network bilgilendir");
        assertThat(created.getTeam()).isEqualTo(team);
        assertThat(created.getCreatedBy()).isEqualTo(completer);
        assertThat(created.getSpawnedFrom()).isEqualTo(source);
        assertThat(created.getStartDate()).isEqualTo(LocalDate.now());
        assertThat(created.getEndDate()).isEqualTo(LocalDate.now().plusDays(2));
        assertThat(c.getTriggeredAt()).isNotNull();
    }

    @Test
    void fireIfDefined_alreadyTriggered_doesNothing() {
        Task source = source();
        TaskChain c = new TaskChain();
        c.setSource(source); c.setTriggeredAt(LocalDateTime.now());
        source.getChains().add(c);

        service.fireIfDefined(source, new User());

        verify(taskRepository, never()).save(any());
    }

    @Test
    void fireIfDefined_oneChainThrows_othersStillCreated() {
        Task source = source();
        Team teamOk = new Team(); teamOk.setId(1L);
        TaskChain bad = new TaskChain(); bad.setSource(source); bad.setTitle("bad");
        bad.setTargetTeam(null); bad.setDurationDays(1); bad.setAssignees(new HashSet<>());
        TaskChain good = new TaskChain(); good.setSource(source); good.setTitle("good");
        good.setTargetTeam(teamOk); good.setDurationDays(1); good.setAssignees(new HashSet<>());
        source.getChains().add(bad); source.getChains().add(good);

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            if (t.getTeam() == null) throw new RuntimeException("no team");
            return t;
        });

        service.fireIfDefined(source, new User());

        verify(taskRepository, atLeastOnce()).save(any());
        assertThat(good.getTriggeredAt()).isNotNull();
        assertThat(bad.getTriggeredAt()).isNull();
    }
}
