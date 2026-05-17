package com.tora.dto;

import com.tora.model.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {
    private Long id;
    private NotificationType type;
    private String title;
    private String message;
    private Long relatedTaskId;
    private String relatedTaskTitle;
    private Long relatedCommentId;
    private Long actorUserId;
    private String actorUsername;
    private String actorFullName;
    private Boolean isRead;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
}
