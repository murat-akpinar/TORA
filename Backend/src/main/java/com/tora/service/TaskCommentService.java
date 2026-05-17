package com.tora.service;

import com.tora.dto.TaskCommentDTO;
import com.tora.dto.TaskCommentRequest;
import com.tora.model.Task;
import com.tora.model.TaskComment;
import com.tora.model.User;
import com.tora.repository.TaskCommentRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class TaskCommentService {

    /**
     * @username şeklindeki etiketleri yakalar.
     * Türkçe karakterleri de kabul eder; uzunluk üst sınırı 100.
     */
    private static final Pattern MENTION_PATTERN =
            Pattern.compile("@([A-Za-z0-9._\\-çÇğĞıİöÖşŞüÜ]{1,100})");

    @Autowired
    private TaskCommentRepository commentRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamService teamService;

    @Autowired
    private NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<TaskCommentDTO> getCommentsForTask(Long taskId) {
        Task task = loadAccessibleTask(taskId);
        return commentRepository.findByTaskIdOrderByCreatedAtAsc(task.getId()).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public TaskCommentDTO createComment(Long taskId, TaskCommentRequest request) {
        Task task = loadAccessibleTask(taskId);
        User currentUser = getCurrentUser();

        TaskComment comment = new TaskComment();
        comment.setTask(task);
        comment.setAuthor(currentUser);
        comment.setContent(request.getContent().trim());
        comment.setMentions(resolveMentions(request.getContent()));

        TaskComment saved = commentRepository.save(comment);

        // Notifications: önce mention edilenler, sonra diğer paydaşlar
        notificationService.notifyCommentMention(saved, saved.getMentions());
        notificationService.notifyNewComment(saved);

        return toDTO(saved);
    }

    @Transactional
    public TaskCommentDTO updateComment(Long commentId, TaskCommentRequest request) {
        TaskComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Yorum bulunamadı"));

        ensureAccessibleTeam(comment.getTask().getTeam().getId());
        ensureCanModify(comment);

        comment.setContent(request.getContent().trim());
        // ManyToMany koleksiyonunu setMentions ile değiştirmeyin — Hibernate join tablosunu
        // tutarsız bırakıp 500 / unique constraint hatasına yol açar. Mevcut Set üzerinde güncelleyin.
        comment.getMentions().clear();
        comment.getMentions().addAll(resolveMentions(request.getContent()));
        comment.setIsEdited(true);

        return toDTO(commentRepository.save(comment));
    }

    @Transactional
    public void deleteComment(Long commentId) {
        TaskComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("Yorum bulunamadı"));

        ensureAccessibleTeam(comment.getTask().getTeam().getId());
        ensureCanModify(comment);

        commentRepository.delete(comment);
    }

    private Task loadAccessibleTask(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("İş bulunamadı"));
        ensureAccessibleTeam(task.getTeam().getId());
        return task;
    }

    /** Erişilebilir birim id'leri içinde bu birim var mı (task id değil, team id). */
    private void ensureAccessibleTeam(Long teamId) {
        List<Long> accessibleTeamIds = teamService.getAccessibleTeamIds();
        if (!accessibleTeamIds.contains(teamId)) {
            throw new RuntimeException("Bu işe erişim izniniz yok");
        }
    }

    private void ensureCanModify(TaskComment comment) {
        User currentUser = getCurrentUser();
        boolean isAuthor = comment.getAuthor().getId().equals(currentUser.getId());
        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> "ADMIN".equalsIgnoreCase(r.getName()));
        if (!isAuthor && !isAdmin) {
            throw new RuntimeException("Bu yorumu sadece yazarı veya yönetici düzenleyebilir");
        }
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Kullanıcı bulunamadı"));
    }

    private Set<User> resolveMentions(String content) {
        if (content == null || content.isBlank()) {
            return new HashSet<>();
        }
        Set<User> mentioned = new HashSet<>();
        Matcher matcher = MENTION_PATTERN.matcher(content);
        while (matcher.find()) {
            String username = matcher.group(1);
            userRepository.findByUsername(username).ifPresent(mentioned::add);
        }
        return mentioned;
    }

    private TaskCommentDTO toDTO(TaskComment comment) {
        List<TaskCommentDTO.MentionedUser> mentions = comment.getMentions().stream()
                .map(u -> TaskCommentDTO.MentionedUser.builder()
                        .userId(u.getId())
                        .username(u.getUsername())
                        .fullName(u.getFullName())
                        .build())
                .collect(Collectors.toList());

        return TaskCommentDTO.builder()
                .id(comment.getId())
                .taskId(comment.getTask().getId())
                .authorId(comment.getAuthor().getId())
                .authorUsername(comment.getAuthor().getUsername())
                .authorFullName(comment.getAuthor().getFullName())
                .content(comment.getContent())
                .isEdited(comment.getIsEdited())
                .mentions(mentions)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }
}
