package com.tora.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "git_settings")
@Data
public class GitSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = false;

    @Column(name = "webhook_secret_encrypted", length = 500)
    private String webhookSecretEncrypted;

    @Column(name = "mr_opened_status", length = 20)
    private String mrOpenedStatus;

    @Column(name = "mr_merged_status", length = 20)
    private String mrMergedStatus;

    @Column(name = "push_status", length = 20)
    private String pushStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
