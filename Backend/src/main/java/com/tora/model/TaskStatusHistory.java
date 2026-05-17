package com.tora.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_status_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
@ToString(exclude = {"task", "changedBy"})
public class TaskStatusHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;
    
    @Column(name = "old_status", length = 20)
    private String oldStatus;
    
    @Column(name = "new_status", nullable = false, length = 20)
    private String newStatus;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = false)
    private User changedBy;
    
    @Column(name = "change_reason", length = 500)
    private String changeReason;

    // POSTPONED durumu kaldırıldığı için artık kullanılmıyor.
    // Kolon, geriye dönük uyumluluk için tabloda tutulmaya devam eder.
    @Deprecated
    @Column(name = "postponed_to_date")
    private java.time.LocalDate postponedToDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

