package com.tora.service;

import com.tora.dto.*;
import com.tora.model.*;
import com.tora.model.enums.TaskStatus;
import com.tora.repository.ProjectRepository;
import com.tora.model.enums.Priority;
import com.tora.model.enums.Role;
import com.tora.repository.*;
import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class TaskService {
    
    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private TeamRepository teamRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private SubtaskRepository subtaskRepository;
    
    @Autowired
    private TaskStatusHistoryRepository statusHistoryRepository;
    
    @Autowired
    private TeamService teamService;
    
    @Autowired
    private ProjectRepository projectRepository;
    
    @Autowired
    private TaskLogService taskLogService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TaskLabelRepository taskLabelRepository;

    @Autowired
    private TaskLabelService taskLabelService;

    @Autowired
    private SlaService slaService;

    @Autowired
    private CacheManager cacheManager;

    // Toplu işlemde her görevi ayrı transaction'da çalıştırmak için proxy self-referans
    @Autowired
    @Lazy
    private TaskService self;

    @Autowired
    private TaskChainService taskChainService;

    @Autowired
    private org.springframework.context.ApplicationEventPublisher eventPublisher;

    /**
     * İlgili teamId ile eşleşen ve "null:" ile başlayan (tüm-birim) dashboard cache
     * girişlerini temizler. allEntries=true yerine hedefli eviction.
     */
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

    public List<TaskDTO> getTasks(Long teamId, Integer year, Integer month, Long projectId) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied to this team");
        }
        
        List<Task> tasks;
        
        // year/month → LocalDate aralığına çevir
        LocalDate dateFrom = null;
        LocalDate dateTo = null;
        if (year != null && month != null) {
            dateFrom = LocalDate.of(year, month, 1);
            dateTo = dateFrom.plusMonths(1);
        } else if (year != null) {
            dateFrom = LocalDate.of(year, 1, 1);
            dateTo = LocalDate.of(year + 1, 1, 1);
        }

        // Eğer projectId verilmişse, direkt projeye ait task'ları getir
        if (projectId != null) {
            // Proje erişim kontrolü
            Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

            User currentUser = getCurrentUser();

            // Yetki kontrolü - getProjectById ile aynı mantık
            boolean hasAccess = false;
            if (project.getTeams() != null && !project.getTeams().isEmpty()) {
                hasAccess = project.getTeams().stream()
                    .anyMatch(team -> accessibleTeamIds.contains(team.getId()));
            }

            if (!hasAccess && !hasRole(currentUser, Role.ADMIN)) {
                throw new RuntimeException("Access denied to this project");
            }

            // Projeye ait task'ları getir
            if (dateFrom != null && month != null) {
                tasks = taskRepository.findByProjectIdAndYearAndMonth(projectId, dateFrom, dateTo);
            } else if (dateFrom != null) {
                tasks = taskRepository.findByProjectIdAndYear(projectId, dateFrom, dateTo);
            } else {
                tasks = taskRepository.findByProjectId(projectId);
            }
        } else if (teamId != null) {
            // Ekip bazlı filtreleme
            if (dateFrom != null && month != null) {
                tasks = taskRepository.findByTeamIdAndYearAndMonth(teamId, dateFrom, dateTo);
            } else if (dateFrom != null) {
                tasks = taskRepository.findByTeamIdAndYear(teamId, dateFrom, dateTo);
            } else {
                tasks = taskRepository.findByTeamId(teamId);
            }
        } else {
            if (accessibleTeamIds.isEmpty()) {
                return new ArrayList<>();
            }
            // Tüm erişilebilir ekiplerin task'ları
            if (dateFrom != null && month != null) {
                tasks = taskRepository.findByTeamIdsAndYearAndMonth(accessibleTeamIds, dateFrom, dateTo);
            } else if (dateFrom != null) {
                tasks = taskRepository.findByTeamIdsAndYear(accessibleTeamIds, dateFrom, dateTo);
            } else {
                tasks = taskRepository.findByTeamIds(accessibleTeamIds);
            }
        }
        
        return tasks.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }
    
    public TaskDTO getTaskById(Long id) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(task.getTeam().getId())) {
            throw new RuntimeException("Access denied");
        }
        
        return convertToDTO(task);
    }
    
    public TaskDTO createTask(CreateTaskRequest request) {
        User currentUser = getCurrentUser();
        Team team = teamRepository.findById(request.getTeamId())
            .orElseThrow(() -> new RuntimeException("Team not found"));
        
        // Yetki kontrolü
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(team.getId())) {
            throw new RuntimeException("Access denied to this team");
        }
        
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setContent(request.getContent());
        task.setStartDate(request.getStartDate());
        task.setEndDate(request.getEndDate());
        task.setStatus(request.getStatus());
        task.setPriority(request.getPriority() != null ? request.getPriority() : Priority.NORMAL);
        task.setTeam(team);
        task.setCreatedBy(currentUser);
        
        // Project assignment
        if (request.getProjectId() != null) {
            Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("Project not found"));
            // Projenin ekibine erişim kontrolü
            boolean hasAccess = project.getTeams().stream()
                .anyMatch(t -> accessibleTeamIds.contains(t.getId()));
            if (!hasAccess) {
                throw new RuntimeException("Access denied to this project");
            }
            task.setProject(project);
        }
        
        // Labels
        Set<TaskLabel> labels = resolveLabels(team.getId(), request);
        task.setLabels(labels);

        // Assignees
        if (request.getAssigneeIds() != null && !request.getAssigneeIds().isEmpty()) {
            Set<User> assignees = request.getAssigneeIds().stream()
                .map(userId -> userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId)))
                .collect(Collectors.toSet());
            task.setAssignees(assignees);
        }

        task = taskRepository.save(task);
        
        // Subtasks
        if (request.getSubtasks() != null && !request.getSubtasks().isEmpty()) {
            for (CreateSubtaskRequest subtaskRequest : request.getSubtasks()) {
                // Skip empty subtasks
                if (subtaskRequest.getTitle() == null || subtaskRequest.getTitle().trim().isEmpty()) {
                    continue;
                }
                Subtask subtask = new Subtask();
                subtask.setTask(task);
                subtask.setTitle(subtaskRequest.getTitle());
                subtask.setContent(subtaskRequest.getContent());
                subtask.setStartDate(subtaskRequest.getStartDate());
                subtask.setEndDate(subtaskRequest.getEndDate());
                if (subtaskRequest.getAssigneeId() != null) {
                    User assignee = userRepository.findById(subtaskRequest.getAssigneeId())
                        .orElseThrow(() -> new RuntimeException("User not found: " + subtaskRequest.getAssigneeId()));
                    subtask.setAssignee(assignee);
                }
                task.getSubtasks().add(subtask);
            }
        }
        
        // Chain definitions (tamamlanınca açılacak takip görevleri)
        if (request.getChains() != null) {
            taskChainService.upsertChains(task, request.getChains());
        }

        // SLA: compute due/status now that createdAt is populated
        slaService.recalculate(task);

        // Log task creation
        taskLogService.logTaskAction(task, "CREATED", currentUser, "Task created", null, convertToDTO(task));

        // Notify newly assigned users (excluding the creator)
        if (task.getAssignees() != null && !task.getAssignees().isEmpty()) {
            notificationService.notifyTaskAssigned(task, task.getAssignees(), currentUser);
        }

        evictDashboardCache(task.getTeam().getId());
        return convertToDTO(task);
    }
    
    public TaskDTO updateTask(Long id, CreateTaskRequest request) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));

        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(task.getTeam().getId()) && !hasProjectAccess(task, accessibleTeamIds)) {
            throw new RuntimeException("Access denied");
        }

        User currentUser = getCurrentUser();
        checkCanModifyTask(task, currentUser);
        
        // Store old values for logging
        TaskDTO oldTaskDTO = convertToDTO(task);
        
        task.setTitle(request.getTitle());
        task.setContent(request.getContent());
        task.setStartDate(request.getStartDate());
        task.setEndDate(request.getEndDate());
        task.setStatus(request.getStatus());
        task.setPriority(request.getPriority() != null ? request.getPriority() : Priority.NORMAL);

        // Labels
        task.setLabels(resolveLabels(task.getTeam().getId(), request));

        // Team güncelleme
        if (request.getTeamId() != null) {
            Team newTeam = teamRepository.findById(request.getTeamId())
                .orElseThrow(() -> new RuntimeException("Team not found"));
            if (!accessibleTeamIds.contains(newTeam.getId())) {
                throw new RuntimeException("Access denied to this team");
            }
            task.setTeam(newTeam);
        }
        
        // Project assignment
        if (request.getProjectId() != null) {
            Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("Project not found"));
            // Projenin ekibine erişim kontrolü
            boolean hasAccess = project.getTeams().stream()
                .anyMatch(t -> accessibleTeamIds.contains(t.getId()));
            if (!hasAccess) {
                throw new RuntimeException("Access denied to this project");
            }
            task.setProject(project);
        } else {
            task.setProject(null);
        }
        
        Set<User> previousAssignees = new HashSet<>(task.getAssignees());
        Set<User> newlyAssigned = new HashSet<>();
        if (request.getAssigneeIds() != null) {
            Set<User> assignees = request.getAssigneeIds().stream()
                .map(userId -> userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId)))
                .collect(Collectors.toSet());
            for (User u : assignees) {
                if (previousAssignees.stream().noneMatch(p -> p.getId().equals(u.getId()))) {
                    newlyAssigned.add(u);
                }
            }
            task.setAssignees(assignees);
        }
        
        // Remove existing subtasks
        task.getSubtasks().clear();
        
        // Add new subtasks
        if (request.getSubtasks() != null && !request.getSubtasks().isEmpty()) {
            for (CreateSubtaskRequest subtaskRequest : request.getSubtasks()) {
                // Skip empty subtasks
                if (subtaskRequest.getTitle() == null || subtaskRequest.getTitle().trim().isEmpty()) {
                    continue;
                }
                Subtask subtask = new Subtask();
                subtask.setTask(task);
                subtask.setTitle(subtaskRequest.getTitle());
                subtask.setContent(subtaskRequest.getContent());
                subtask.setStartDate(subtaskRequest.getStartDate());
                subtask.setEndDate(subtaskRequest.getEndDate());
                if (subtaskRequest.getAssigneeId() != null) {
                    User assignee = userRepository.findById(subtaskRequest.getAssigneeId())
                        .orElseThrow(() -> new RuntimeException("User not found: " + subtaskRequest.getAssigneeId()));
                    subtask.setAssignee(assignee);
                }
                task.getSubtasks().add(subtask);
            }
        }
        
        // Chain definitions
        if (request.getChains() != null) {
            taskChainService.upsertChains(task, request.getChains());
        }

        task = taskRepository.save(task);

        // SLA: recompute on update (priority/team/status may have changed)
        slaService.recalculate(task);

        // Log task update
        TaskDTO newTaskDTO = convertToDTO(task);
        taskLogService.logTaskAction(task, "UPDATED", currentUser, "Task updated", oldTaskDTO, newTaskDTO);

        // Notify newly assigned users
        if (!newlyAssigned.isEmpty()) {
            notificationService.notifyTaskAssigned(task, newlyAssigned, currentUser);
        }
        // Notify on status change via updateTask (when status is part of full update)
        if (oldTaskDTO.getStatus() != null && task.getStatus() != null
                && !oldTaskDTO.getStatus().equals(task.getStatus())) {
            notificationService.notifyTaskStatusChanged(task,
                    oldTaskDTO.getStatus().name(), task.getStatus().name(), currentUser);
        }
        // Zincir: düzenleme formundan COMPLETED'e geçilirse de tetiklensin
        publishIfCompleted(oldTaskDTO.getStatus(), task, currentUser);

        evictDashboardCache(task.getTeam().getId());
        return newTaskDTO;
    }

    // Yalnızca COMPLETED'e GEÇİŞTE event yayınla; tetikleme AFTER_COMMIT'te ayrı tx'te çalışır
    private void publishIfCompleted(TaskStatus oldStatus, Task task, User completer) {
        if (task.getStatus() == TaskStatus.COMPLETED && oldStatus != TaskStatus.COMPLETED) {
            eventPublisher.publishEvent(new com.tora.event.TaskCompletedEvent(task.getId(), completer.getId()));
        }
    }

    public void deleteTask(Long id) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(task.getTeam().getId())) {
            throw new RuntimeException("Access denied");
        }

        User currentUser = getCurrentUser();
        checkCanDeleteTask(task, currentUser);

        // Log task deletion before deleting
        TaskDTO taskDTO = convertToDTO(task);
        taskLogService.logTaskAction(task, "DELETED", currentUser, "Task deleted", taskDTO, null);
        
        // Task'a ait tüm log'ların task referansını null yap (log'lar korunsun)
        taskLogService.detachTaskFromLogs(task);

        Long teamId = task.getTeam().getId();
        taskRepository.delete(task);
        evictDashboardCache(teamId);
    }

    public TaskDTO updateTaskStatus(Long id, UpdateTaskStatusRequest request) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));

        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(task.getTeam().getId()) && !hasProjectAccess(task, accessibleTeamIds)) {
            throw new RuntimeException("Access denied");
        }

        User currentUser = getCurrentUser();
        checkCanModifyTask(task, currentUser);
        TaskStatus oldStatus = task.getStatus();

        TaskStatusHistory history = new TaskStatusHistory();
        history.setTask(task);
        history.setOldStatus(oldStatus.name());
        history.setNewStatus(request.getStatus().name());
        history.setChangedBy(currentUser);
        history.setChangeReason(request.getChangeReason());

        task.setStatus(request.getStatus());
        task = taskRepository.save(task);
        statusHistoryRepository.save(history);

        // SLA: recompute (sets completedAt + MET/BREACHED on completion)
        slaService.recalculate(task);
        
        // Log status change in task logs
        taskLogService.logTaskAction(
            task, 
            "STATUS_CHANGED", 
            currentUser, 
            request.getChangeReason(), 
            oldStatus.name(), 
            request.getStatus().name()
        );

        // Notify stakeholders
        if (!oldStatus.equals(request.getStatus())) {
            notificationService.notifyTaskStatusChanged(task,
                    oldStatus.name(), request.getStatus().name(), currentUser);
        }
        // Zincir: COMPLETED'e geçişte event (bulk işlemler bu metodu çağırdığı için otomatik kapsanır)
        publishIfCompleted(oldStatus, task, currentUser);

        evictDashboardCache(task.getTeam().getId());
        return convertToDTO(task);
    }
    
    // ───────────────── BULK OPERATIONS ─────────────────

    // Dış transaction yok; her görev `self` proxy üzerinden kendi tx'inde işlenir
    // (biri DB hatası verse diğerleri etkilenmez, başarılılar kalıcı olur → doğru sayım).
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public BulkResultDTO bulkOperation(BulkTaskRequest request) {
        if (request.getTaskIds() == null || request.getTaskIds().isEmpty()) {
            throw new RuntimeException("Görev seçilmedi");
        }
        int succeeded = 0;
        int failed = 0;
        List<String> errors = new ArrayList<>();

        for (Long id : request.getTaskIds()) {
            try {
                switch (request.getAction() == null ? "" : request.getAction()) {
                    case "STATUS" -> {
                        if (request.getStatus() == null) throw new RuntimeException("Durum gerekli");
                        UpdateTaskStatusRequest sr = new UpdateTaskStatusRequest();
                        sr.setStatus(request.getStatus());
                        sr.setChangeReason(request.getChangeReason());
                        self.updateTaskStatus(id, sr);
                    }
                    case "ASSIGN" -> self.bulkAssign(id, request.getAssigneeId());
                    case "DELETE" -> self.deleteTask(id);
                    default -> throw new RuntimeException("Geçersiz işlem: " + request.getAction());
                }
                succeeded++;
            } catch (Exception e) {
                failed++;
                errors.add("#" + id + ": " + e.getMessage());
            }
        }
        return new BulkResultDTO(succeeded, failed, errors);
    }

    public void bulkAssign(Long id, Long assigneeId) {
        if (assigneeId == null) throw new RuntimeException("Atanacak kullanıcı gerekli");
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));

        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(task.getTeam().getId()) && !hasProjectAccess(task, accessibleTeamIds)) {
            throw new RuntimeException("Access denied");
        }
        User currentUser = getCurrentUser();
        checkCanModifyTask(task, currentUser);

        User assignee = userRepository.findById(assigneeId)
            .orElseThrow(() -> new RuntimeException("User not found: " + assigneeId));
        boolean isNew = task.getAssignees().stream().noneMatch(u -> u.getId().equals(assigneeId));

        TaskDTO oldDto = convertToDTO(task);
        Set<User> assignees = new HashSet<>(task.getAssignees());
        assignees.add(assignee);
        task.setAssignees(assignees);
        task = taskRepository.save(task);

        taskLogService.logTaskAction(task, "ASSIGNEE_ADDED", currentUser, "Toplu atama", oldDto, convertToDTO(task));
        if (isNew) {
            notificationService.notifyTaskAssigned(task, Set.of(assignee), currentUser);
        }
        evictDashboardCache(task.getTeam().getId());
    }

    // ───────────────── /BULK OPERATIONS ─────────────────

    public List<TaskDTO> getTasksByDateRange(LocalDate startDate, LocalDate endDate, Long teamId) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        
        if (teamId != null && !accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Access denied");
        }
        
        List<Long> teamIds = teamId != null ? List.of(teamId) : accessibleTeamIds;
        
        return taskRepository.findByTeamIdsAndDateRange(teamIds, startDate, endDate).stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }
    
    private Set<TaskLabel> resolveLabels(Long teamId, CreateTaskRequest request) {
        Set<TaskLabel> labels = new HashSet<>();
        if (request.getLabelIds() != null) {
            for (Long labelId : request.getLabelIds()) {
                taskLabelRepository.findById(labelId)
                    .ifPresent(labels::add);
            }
        }
        if (request.getNewLabelNames() != null) {
            for (String name : request.getNewLabelNames()) {
                if (name != null && !name.isBlank()) {
                    labels.add(taskLabelService.findOrCreate(teamId, name));
                }
            }
        }
        return labels;
    }

    private TaskDTO convertToDTO(Task task) {
        TaskDTO dto = new TaskDTO();
        dto.setId(task.getId());
        dto.setCode(task.getCode());
        dto.setTitle(task.getTitle());
        dto.setContent(task.getContent());
        dto.setStartDate(task.getStartDate());
        dto.setEndDate(task.getEndDate());
        dto.setStatus(task.getStatus());
        dto.setPriority(task.getPriority());
        dto.setLabels(task.getLabels().stream()
            .map(taskLabelService::toDTO)
            .collect(Collectors.toList()));
        dto.setTeamId(task.getTeam().getId());
        dto.setTeamName(task.getTeam().getName());
        dto.setTeamColor(task.getTeam().getColor());
        dto.setTeamIcon(task.getTeam().getIcon());
        if (task.getProject() != null) {
            dto.setProjectId(task.getProject().getId());
            dto.setProjectName(task.getProject().getName());
            if (task.getProject().getManager() != null) {
                dto.setProjectManagerId(task.getProject().getManager().getId());
            }
        }
        dto.setCreatedById(task.getCreatedBy().getId());
        dto.setCreatedByName(task.getCreatedBy().getFullName());
        dto.setAssigneeIds(task.getAssignees().stream()
            .map(User::getId)
            .collect(Collectors.toSet()));
        dto.setAssigneeNames(task.getAssignees().stream()
            .map(User::getFullName)
            .collect(Collectors.toList()));
        dto.setSubtasks(task.getSubtasks().stream()
            .map(this::convertSubtaskToDTO)
            .collect(Collectors.toList()));
        dto.setSlaStatus(task.getSlaStatus());
        dto.setSlaDueAt(task.getSlaDueAt());

        if (task.getSpawnedFrom() != null) {
            dto.setSpawnedFromTaskId(task.getSpawnedFrom().getId());
            dto.setSpawnedFromTitle(task.getSpawnedFrom().getTitle());
        }
        if (task.getChains() != null && !task.getChains().isEmpty()) {
            dto.setChains(task.getChains().stream().map(c -> {
                com.tora.dto.TaskChainDTO cd = new com.tora.dto.TaskChainDTO();
                cd.setId(c.getId());
                cd.setTitle(c.getTitle());
                cd.setContent(c.getContent());
                cd.setTargetTeamId(c.getTargetTeam() != null ? c.getTargetTeam().getId() : null);
                cd.setTargetTeamName(c.getTargetTeam() != null ? c.getTargetTeam().getName() : null);
                cd.setTargetProjectId(c.getTargetProject() != null ? c.getTargetProject().getId() : null);
                cd.setPriority(c.getPriority());
                cd.setDurationDays(c.getDurationDays());
                cd.setAssigneeIds(c.getAssignees() == null ? java.util.List.of()
                    : c.getAssignees().stream().map(User::getId).collect(Collectors.toList()));
                cd.setTriggeredAt(c.getTriggeredAt());
                return cd;
            }).collect(Collectors.toList()));
        }
        return dto;
    }
    
    private SubtaskDTO convertSubtaskToDTO(Subtask subtask) {
        SubtaskDTO dto = new SubtaskDTO();
        dto.setId(subtask.getId());
        dto.setTitle(subtask.getTitle());
        dto.setContent(subtask.getContent());
        dto.setStartDate(subtask.getStartDate());
        dto.setEndDate(subtask.getEndDate());
        if (subtask.getAssignee() != null) {
            dto.setAssigneeId(subtask.getAssignee().getId());
            dto.setAssigneeName(subtask.getAssignee().getFullName());
        }
        dto.setIsCompleted(subtask.getIsCompleted());
        return dto;
    }
    
    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
    
    private boolean hasRole(User user, Role role) {
        return user.getRoles().stream()
            .anyMatch(r -> r.getName().equals(role.name()));
    }

    private boolean hasProjectAccess(Task task, List<Long> accessibleTeamIds) {
        if (task.getProject() == null) return false;
        return task.getProject().getTeams().stream()
            .anyMatch(t -> accessibleTeamIds.contains(t.getId()));
    }

    private void checkCanDeleteTask(Task task, User currentUser) {
        if (hasRole(currentUser, Role.ADMIN) || hasRole(currentUser, Role.BIRIM_AMIRI)) {
            return;
        }
        boolean isCreator = task.getCreatedBy() != null && task.getCreatedBy().getId().equals(currentUser.getId());
        if (!isCreator) {
            throw new RuntimeException("Sadece kendi oluşturduğunuz işleri silebilirsiniz");
        }
    }

    private void checkCanModifyTask(Task task, User currentUser) {
        if (hasRole(currentUser, Role.ADMIN) || hasRole(currentUser, Role.BIRIM_AMIRI)) {
            return;
        }
        // Projenin yöneticisi o projedeki tüm işleri düzenleyebilir
        if (task.getProject() != null
                && task.getProject().getManager() != null
                && task.getProject().getManager().getId().equals(currentUser.getId())) {
            return;
        }
        boolean isCreator = task.getCreatedBy() != null && task.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = task.getAssignees().stream().anyMatch(a -> a.getId().equals(currentUser.getId()));
        if (!isCreator && !isAssignee) {
            throw new RuntimeException("Sadece kendi oluşturduğunuz veya size atanan işleri güncelleyebilirsiniz");
        }
    }
}

