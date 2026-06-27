package com.tora.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "task_git_links")
@Data
public class TaskGitLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(nullable = false, length = 20)
    private String platform;

    @Column(name = "link_type", nullable = false, length = 20)
    private String linkType;

    @Column(name = "external_id", nullable = false, length = 255)
    private String externalId;

    @Column(length = 1000)
    private String url;

    @Column(length = 500)
    private String title;

    @Column(length = 30)
    private String status;

    @Column(length = 255)
    private String branch;

    @Column(length = 255)
    private String author;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
