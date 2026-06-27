package com.tora.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.tora.dto.TaskChainRequest;
import com.tora.event.TaskCompletedEvent;
import com.tora.model.*;
import com.tora.model.enums.Priority;
import com.tora.model.enums.TaskStatus;
import com.tora.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TaskChainService {

    private static final Logger log = LoggerFactory.getLogger(TaskChainService.class);

    @Autowired private TaskChainRepository taskChainRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private SlaService slaService;
    @Autowired private TaskLogService taskLogService;
    @Autowired private NotificationService notificationService;
    @Autowired private CacheManager cacheManager;

    // ───────────────── DEFINITION MGMT ─────────────────
    public void upsertChains(Task source, List<TaskChainRequest> defs) {
        source.getChains().clear(); // orphanRemoval mevcutları siler
        if (defs == null || defs.isEmpty()) return;

        for (TaskChainRequest req : defs) {
            Team team = teamRepository.findById(req.getTargetTeamId())
                .orElseThrow(() -> new RuntimeException("Hedef birim bulunamadı: " + req.getTargetTeamId()));
            TaskChain c = new TaskChain();
            c.setSource(source);
            c.setTitle(req.getTitle());
            c.setContent(req.getContent());
            c.setTargetTeam(team);
            if (req.getTargetProjectId() != null) {
                c.setTargetProject(projectRepository.findById(req.getTargetProjectId()).orElse(null));
            }
            c.setPriority(req.getPriority());
            c.setDurationDays(req.getDurationDays() != null ? req.getDurationDays() : 0);
            if (req.getAssigneeIds() != null && !req.getAssigneeIds().isEmpty()) {
                Set<User> users = req.getAssigneeIds().stream()
                    .map(id -> userRepository.findById(id).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
                c.setAssignees(users);
            }
            source.getChains().add(c);
        }
    }

    // ───────────────── TRIGGER ─────────────────
    // Tamamlama commit OLDUKTAN sonra, AYRI tx'te çalışır → tamamlamayı asla bozamaz.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onTaskCompleted(TaskCompletedEvent event) {
        Task source = taskRepository.findById(event.sourceTaskId()).orElse(null);
        User completer = userRepository.findById(event.completerId()).orElse(null);
        if (source == null || completer == null) return;
        fireIfDefined(source, completer);
    }

    /** Kaynak COMPLETED olduğunda çağrılır. Her tanım best-effort; biri patlarsa diğerleri devam. */
    public void fireIfDefined(Task source, User completer) {
        if (source.getChains() == null || source.getChains().isEmpty()) return;
        for (TaskChain c : source.getChains()) {
            if (c.getTriggeredAt() != null) continue; // bir-kez garantisi
            try {
                spawn(source, c, completer);
                c.setTriggeredAt(LocalDateTime.now());
            } catch (Exception ex) {
                log.warn("Zincir görevi üretilemedi (sourceId={}, chainTitle={}): {}",
                         source.getId(), c.getTitle(), ex.getMessage());
            }
        }
    }

    private void spawn(Task source, TaskChain c, User completer) {
        LocalDate today = LocalDate.now();
        Task t = new Task();
        t.setTitle(c.getTitle());
        t.setContent(c.getContent());
        t.setTeam(c.getTargetTeam());            // erişim kontrolü baypas (sistem üretir)
        t.setProject(c.getTargetProject());
        t.setPriority(c.getPriority() != null ? c.getPriority() : Priority.NORMAL);
        t.setStatus(TaskStatus.OPEN);
        t.setStartDate(today);
        t.setEndDate(today.plusDays(c.getDurationDays() != null ? c.getDurationDays() : 0));
        t.setCreatedBy(completer);
        t.setSpawnedFrom(source);
        if (c.getAssignees() != null && !c.getAssignees().isEmpty()) {
            t.setAssignees(new HashSet<>(c.getAssignees()));
        }
        Task saved = taskRepository.save(t);

        slaService.recalculate(saved);
        taskLogService.logTaskAction(source, "CHAIN_TRIGGERED", completer,
            "Zincir tetiklendi → " + c.getTitle(), null, null);
        taskLogService.logTaskAction(saved, "CHAIN_CREATED", completer,
            "Zincirle oluşturuldu (kaynak #" + source.getId() + ")", null, null);
        if (saved.getAssignees() != null && !saved.getAssignees().isEmpty()) {
            notificationService.notifyTaskAssigned(saved, saved.getAssignees(), completer);
        }
        evictDashboardCache(saved.getTeam().getId());
    }

    private void evictDashboardCache(Long teamId) {
        for (String cacheName : List.of("dashboardStats", "dashboardDetails")) {
            org.springframework.cache.Cache springCache = cacheManager.getCache(cacheName);
            if (springCache instanceof CaffeineCache caffeineCache) {
                Cache<Object, Object> nativeCache = caffeineCache.getNativeCache();
                String teamPrefix = teamId + ":";
                nativeCache.asMap().keySet().removeIf(key -> {
                    String k = key.toString();
                    return k.startsWith(teamPrefix) || k.startsWith("null:");
                });
            }
        }
    }
}
