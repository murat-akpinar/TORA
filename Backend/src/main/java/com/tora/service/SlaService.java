package com.tora.service;

import com.tora.dto.CreateSlaPolicyRequest;
import com.tora.dto.SlaComplianceDTO;
import com.tora.dto.SlaPolicyDTO;
import com.tora.model.SlaPolicy;
import com.tora.model.Task;
import com.tora.model.Team;
import com.tora.model.enums.Priority;
import com.tora.model.enums.SlaStatus;
import com.tora.model.enums.TaskStatus;
import com.tora.repository.SlaPolicyRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.TeamRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * SLA engine: matches tasks to the most specific active policy, computes the
 * resolution due time (optionally counting business days only), tracks per-task
 * SLA state, and emits at-risk / breach notifications on transition.
 */
@Service
public class SlaService {

    private static final Logger log = LoggerFactory.getLogger(SlaService.class);
    private static final List<TaskStatus> TERMINAL = Arrays.asList(TaskStatus.COMPLETED, TaskStatus.CANCELLED);
    private static final double AT_RISK_THRESHOLD = 0.8; // %80 of the window elapsed

    @Autowired
    private SlaPolicyRepository slaPolicyRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private NotificationService notificationService;

    // ---------------- Per-task recalculation (called by TaskService) ----------------

    /**
     * Sets slaDueAt + slaStatus on the task in place (no save, no notification).
     * Safe to call on every create/update/status change.
     */
    public void recalculate(Task task) {
        SlaPolicy policy = findMatchingPolicy(task);
        if (policy == null) {
            task.setSlaDueAt(null);
            task.setSlaStatus(null);
            return;
        }

        TaskStatus status = task.getStatus();
        if (status == TaskStatus.CANCELLED) {
            task.setSlaDueAt(null);
            task.setSlaStatus(null); // SLA not meaningful for cancelled work
            return;
        }

        LocalDateTime start = task.getCreatedAt() != null ? task.getCreatedAt() : LocalDateTime.now();
        LocalDateTime due = computeDueAt(start, policy.getTargetHours(), Boolean.TRUE.equals(policy.getBusinessHoursOnly()));
        task.setSlaDueAt(due);

        if (status == TaskStatus.COMPLETED) {
            if (task.getCompletedAt() == null) task.setCompletedAt(LocalDateTime.now());
            task.setSlaStatus(task.getCompletedAt().isAfter(due) ? SlaStatus.BREACHED : SlaStatus.MET);
        } else {
            task.setCompletedAt(null);
            task.setSlaStatus(computeOpenStatus(start, due, LocalDateTime.now()));
        }
    }

    private SlaStatus computeOpenStatus(LocalDateTime start, LocalDateTime due, LocalDateTime now) {
        if (!now.isBefore(due)) return SlaStatus.BREACHED;
        long total = Duration.between(start, due).toMinutes();
        long elapsed = Duration.between(start, now).toMinutes();
        if (total > 0 && elapsed >= total * AT_RISK_THRESHOLD) return SlaStatus.AT_RISK;
        return SlaStatus.ON_TRACK;
    }

    SlaPolicy findMatchingPolicy(Task task) {
        SlaPolicy best = null;
        int bestScore = -1;
        for (SlaPolicy p : slaPolicyRepository.findByIsActiveTrue()) {
            if (p.getPriority() != null && p.getPriority() != task.getPriority()) continue;
            if (p.getTeam() != null) {
                if (task.getTeam() == null || !p.getTeam().getId().equals(task.getTeam().getId())) continue;
            }
            int score = (p.getPriority() != null ? 2 : 0) + (p.getTeam() != null ? 1 : 0);
            if (score > bestScore) {
                best = p;
                bestScore = score;
            }
        }
        return best;
    }

    /** Adds {@code hours} to {@code start}; when businessOnly, only Mon–Fri hours count. */
    LocalDateTime computeDueAt(LocalDateTime start, int hours, boolean businessOnly) {
        if (!businessOnly) return start.plusHours(hours);
        LocalDateTime t = start;
        int remaining = hours;
        while (remaining > 0) {
            t = t.plusHours(1);
            DayOfWeek d = t.getDayOfWeek();
            if (d != DayOfWeek.SATURDAY && d != DayOfWeek.SUNDAY) remaining--;
        }
        return t;
    }

    // ---------------- Scheduled evaluation ----------------

    /** Every 30 minutes: refresh SLA state for open tasks and notify on transition to AT_RISK / BREACHED. */
    @Scheduled(cron = "0 */30 * * * *")
    @Transactional
    public void evaluateOpenTasks() {
        List<Task> openTasks = taskRepository.findByStatusNotIn(TERMINAL);
        int notified = 0;
        for (Task task : openTasks) {
            SlaStatus before = task.getSlaStatus();
            recalculate(task);
            SlaStatus after = task.getSlaStatus();
            if (after != before) {
                taskRepository.save(task);
                // Skip notifying on the very first evaluation (before == null):
                // pre-existing tasks just get a baseline status set, avoiding a
                // burst of breach notifications for historical work.
                if (before != null) {
                    try {
                        if (after == SlaStatus.BREACHED) {
                            notificationService.notifySlaBreached(task);
                            notified++;
                        } else if (after == SlaStatus.AT_RISK) {
                            notificationService.notifySlaAtRisk(task);
                            notified++;
                        }
                    } catch (Exception ex) {
                        log.warn("SLA bildirimi üretilemedi (taskId={}): {}", task.getId(), ex.getMessage());
                    }
                }
            }
        }
        if (notified > 0) log.info("SLA değerlendirmesi: {} bildirim üretildi", notified);
    }

    // ---------------- Compliance metric ----------------

    @Transactional(readOnly = true)
    public SlaComplianceDTO getCompliance(Long teamId) {
        long onTrack = 0, atRisk = 0, breached = 0, met = 0;
        for (Object[] row : taskRepository.countBySlaStatus(teamId)) {
            SlaStatus status = (SlaStatus) row[0];
            long count = ((Number) row[1]).longValue();
            switch (status) {
                case ON_TRACK -> onTrack = count;
                case AT_RISK -> atRisk = count;
                case BREACHED -> breached = count;
                case MET -> met = count;
            }
        }
        long resolved = met + breached;
        double rate = resolved > 0 ? (met * 100.0) / resolved : 0.0;
        return new SlaComplianceDTO(onTrack, atRisk, breached, met, Math.round(rate * 10.0) / 10.0);
    }

    // ---------------- Admin CRUD ----------------

    @Transactional(readOnly = true)
    public List<SlaPolicyDTO> listPolicies() {
        return slaPolicyRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public SlaPolicyDTO createPolicy(CreateSlaPolicyRequest req) {
        SlaPolicy p = new SlaPolicy();
        apply(p, req);
        return toDTO(slaPolicyRepository.save(p));
    }

    @Transactional
    public SlaPolicyDTO updatePolicy(Long id, CreateSlaPolicyRequest req) {
        SlaPolicy p = slaPolicyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("SLA politikası bulunamadı"));
        apply(p, req);
        return toDTO(slaPolicyRepository.save(p));
    }

    @Transactional
    public void deletePolicy(Long id) {
        if (!slaPolicyRepository.existsById(id)) {
            throw new RuntimeException("SLA politikası bulunamadı");
        }
        slaPolicyRepository.deleteById(id);
    }

    private void apply(SlaPolicy p, CreateSlaPolicyRequest req) {
        p.setName(req.getName());
        p.setPriority(req.getPriority() != null && !req.getPriority().isBlank()
                ? Priority.valueOf(req.getPriority()) : null);
        if (req.getTeamId() != null) {
            Team team = teamRepository.findById(req.getTeamId())
                    .orElseThrow(() -> new RuntimeException("Birim bulunamadı"));
            p.setTeam(team);
        } else {
            p.setTeam(null);
        }
        p.setTargetHours(req.getTargetHours());
        p.setBusinessHoursOnly(Boolean.TRUE.equals(req.getBusinessHoursOnly()));
        p.setIsActive(req.getIsActive() == null || req.getIsActive());
    }

    private SlaPolicyDTO toDTO(SlaPolicy p) {
        return new SlaPolicyDTO(
                p.getId(),
                p.getName(),
                p.getPriority() != null ? p.getPriority().name() : null,
                p.getTeam() != null ? p.getTeam().getId() : null,
                p.getTeam() != null ? p.getTeam().getName() : null,
                p.getTargetHours(),
                p.getBusinessHoursOnly(),
                p.getIsActive());
    }
}
