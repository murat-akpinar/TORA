package com.tora.service;

import com.tora.dto.NotificationDTO;
import com.tora.dto.NotificationPageDTO;
import com.tora.model.Notification;
import com.tora.model.Task;
import com.tora.model.TaskComment;
import com.tora.model.User;
import com.tora.model.enums.NotificationType;
import com.tora.repository.NotificationRepository;
import com.tora.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    /** Aynı atama/durum değişikliği bildiriminin kısa süre içinde tekrar üretilmesini engelle */
    private static final long DEDUP_WINDOW_SECONDS = 60;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    // ------------- Üretim API'leri -------------

    @Transactional
    public void notifyTaskAssigned(Task task, Collection<User> newAssignees, User actor) {
        if (newAssignees == null || newAssignees.isEmpty()) return;
        for (User recipient : newAssignees) {
            if (recipient == null) continue;
            if (actor != null && recipient.getId().equals(actor.getId())) continue;
            saveDeduped(recipient, NotificationType.TASK_ASSIGNED, task, null, actor,
                    "Yeni iş atandı",
                    "\"" + task.getTitle() + "\" işine atandınız.");
        }
    }

    @Transactional
    public void notifyTaskStatusChanged(Task task, String oldStatus, String newStatus, User actor) {
        List<User> recipients = collectTaskStakeholders(task, actor);
        if (recipients.isEmpty()) return;

        String message = "\"" + task.getTitle() + "\" işinin durumu " + oldStatus + " → " + newStatus + " olarak güncellendi.";
        for (User recipient : recipients) {
            saveDeduped(recipient, NotificationType.TASK_STATUS_CHANGED, task, null, actor,
                    "İş durumu değişti", message);
        }
    }

    @Transactional
    public void notifyCommentMention(TaskComment comment, Collection<User> mentionedUsers) {
        if (mentionedUsers == null || mentionedUsers.isEmpty()) return;
        User actor = comment.getAuthor();
        Task task = comment.getTask();
        for (User recipient : mentionedUsers) {
            if (recipient == null) continue;
            if (recipient.getId().equals(actor.getId())) continue;
            Notification n = new Notification();
            n.setUser(recipient);
            n.setType(NotificationType.COMMENT_MENTION);
            n.setTitle("Bir yorumda bahsedildiniz");
            n.setMessage(actor.getFullName() + " sizden \"" + task.getTitle() + "\" işinde bahsetti.");
            n.setRelatedTask(task);
            n.setRelatedComment(comment);
            n.setActorUser(actor);
            notificationRepository.save(n);
        }
    }

    @Transactional
    public void notifyNewComment(TaskComment comment) {
        Task task = comment.getTask();
        User author = comment.getAuthor();
        List<User> stakeholders = collectTaskStakeholders(task, author);
        // mention edilenler ayrı bildirimi zaten alacak, dedup için filtrele
        List<Long> mentionedIds = comment.getMentions().stream().map(User::getId).collect(Collectors.toList());

        for (User recipient : stakeholders) {
            if (mentionedIds.contains(recipient.getId())) continue;
            Notification n = new Notification();
            n.setUser(recipient);
            n.setType(NotificationType.COMMENT_ON_TASK);
            n.setTitle("Yeni yorum");
            n.setMessage(author.getFullName() + ", \"" + task.getTitle() + "\" işine yorum yaptı.");
            n.setRelatedTask(task);
            n.setRelatedComment(comment);
            n.setActorUser(author);
            notificationRepository.save(n);
        }
    }

    @Transactional
    public void notifyDueSoon(Task task) {
        for (User assignee : task.getAssignees()) {
            saveDeduped(assignee, NotificationType.TASK_DUE_SOON, task, null, null,
                    "İşin bitiş tarihi yaklaşıyor",
                    "\"" + task.getTitle() + "\" işi yarın (" + task.getEndDate() + ") sona eriyor.");
        }
    }

    private void saveDeduped(User recipient, NotificationType type, Task task, TaskComment comment,
                             User actor, String title, String message) {
        try {
            LocalDateTime since = LocalDateTime.now().minusSeconds(DEDUP_WINDOW_SECONDS);
            Long taskId = task != null ? task.getId() : null;
            List<Notification> recent = notificationRepository.findRecentSimilar(
                    recipient.getId(), type, taskId, since);
            if (!recent.isEmpty()) return;

            Notification n = new Notification();
            n.setUser(recipient);
            n.setType(type);
            n.setTitle(title);
            n.setMessage(message);
            n.setRelatedTask(task);
            n.setRelatedComment(comment);
            n.setActorUser(actor);
            notificationRepository.save(n);
        } catch (Exception ex) {
            // Bildirim üretimi ana akışı asla bozmamalı
            log.warn("Bildirim üretimi başarısız ({}): {}", type, ex.getMessage());
        }
    }

    private List<User> collectTaskStakeholders(Task task, User actor) {
        List<User> recipients = new ArrayList<>();
        if (task.getAssignees() != null) {
            for (User u : task.getAssignees()) {
                if (actor == null || !u.getId().equals(actor.getId())) {
                    recipients.add(u);
                }
            }
        }
        if (task.getCreatedBy() != null) {
            User creator = task.getCreatedBy();
            boolean isActor = actor != null && creator.getId().equals(actor.getId());
            boolean alreadyIn = recipients.stream().anyMatch(u -> u.getId().equals(creator.getId()));
            if (!isActor && !alreadyIn) {
                recipients.add(creator);
            }
        }
        return recipients;
    }

    // ------------- Tüketim API'leri (controller) -------------

    @Transactional(readOnly = true)
    public NotificationPageDTO getMyNotifications(int page, int size) {
        User current = getCurrentUser();
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
        Page<Notification> result = notificationRepository.findByUserIdOrderByCreatedAtDesc(current.getId(), pageable);
        long unreadCount = notificationRepository.countByUserIdAndIsReadFalse(current.getId());

        List<NotificationDTO> dtos = result.getContent().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return NotificationPageDTO.builder()
                .content(dtos)
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .unreadCount(unreadCount)
                .build();
    }

    @Transactional(readOnly = true)
    public long getMyUnreadCount() {
        User current = getCurrentUser();
        return notificationRepository.countByUserIdAndIsReadFalse(current.getId());
    }

    @Transactional
    public NotificationDTO markRead(Long id) {
        User current = getCurrentUser();
        Notification n = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Bildirim bulunamadı"));
        if (!n.getUser().getId().equals(current.getId())) {
            throw new RuntimeException("Bu bildirime erişim izniniz yok");
        }
        if (!Boolean.TRUE.equals(n.getIsRead())) {
            n.setIsRead(true);
            n.setReadAt(LocalDateTime.now());
            n = notificationRepository.save(n);
        }
        return toDTO(n);
    }

    @Transactional
    public int markAllRead() {
        User current = getCurrentUser();
        return notificationRepository.markAllReadForUser(current.getId(), LocalDateTime.now());
    }

    @Transactional
    public void delete(Long id) {
        User current = getCurrentUser();
        Notification n = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Bildirim bulunamadı"));
        if (!n.getUser().getId().equals(current.getId())) {
            throw new RuntimeException("Bu bildirime erişim izniniz yok");
        }
        notificationRepository.delete(n);
    }

    @Transactional
    public int deleteAll() {
        User current = getCurrentUser();
        return notificationRepository.deleteAllForUser(current.getId());
    }

    // ------------- Yardımcılar -------------

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı"));
    }

    private NotificationDTO toDTO(Notification n) {
        return NotificationDTO.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .relatedTaskId(n.getRelatedTask() != null ? n.getRelatedTask().getId() : null)
                .relatedTaskTitle(n.getRelatedTask() != null ? n.getRelatedTask().getTitle() : null)
                .relatedCommentId(n.getRelatedComment() != null ? n.getRelatedComment().getId() : null)
                .actorUserId(n.getActorUser() != null ? n.getActorUser().getId() : null)
                .actorUsername(n.getActorUser() != null ? n.getActorUser().getUsername() : null)
                .actorFullName(n.getActorUser() != null ? n.getActorUser().getFullName() : null)
                .isRead(n.getIsRead())
                .createdAt(n.getCreatedAt())
                .readAt(n.getReadAt())
                .build();
    }
}
