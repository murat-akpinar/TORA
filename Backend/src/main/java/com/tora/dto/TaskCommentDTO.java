package com.tora.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskCommentDTO {
    private Long id;
    private Long taskId;
    private Long authorId;
    private String authorUsername;
    private String authorFullName;
    private String content;
    private Boolean isEdited;
    private List<MentionedUser> mentions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MentionedUser {
        private Long userId;
        private String username;
        private String fullName;
    }
}
