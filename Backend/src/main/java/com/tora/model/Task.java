package com.tora.model;

import com.tora.model.enums.TaskStatus;
import com.tora.model.enums.TaskType;
import com.tora.model.enums.Priority;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
@ToString(exclude = {"subtasks", "assignees", "statusHistory", "team", "createdBy", "project", "chains", "spawnedFrom"})
public class Task {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 255)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String content;
    
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status = TaskStatus.OPEN;
    
    @Deprecated
    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = true, length = 20)
    private TaskType taskType;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Priority priority = Priority.NORMAL;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;
    
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_assignees",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @BatchSize(size = 50)
    private Set<User> assignees = new HashSet<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    private Set<Subtask> subtasks = new HashSet<>();

    // List (Set değil): henüz id almamış birden çok tanım id-eşitliğiyle çakışmasın → tümü korunur
    @OneToMany(mappedBy = "source", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 50)
    private List<TaskChain> chains = new ArrayList<>();

    // Zincirle üretilen görev → kaynağı (geri bağ)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "spawned_from_task_id")
    private Task spawnedFrom;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<TaskStatusHistory> statusHistory = new HashSet<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_label_assignments",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "label_id")
    )
    @BatchSize(size = 50)
    private Set<TaskLabel> labels = new HashSet<>();
    
    // Aşağıdaki alanlar POSTPONED durumu kaldırıldığı için artık kullanılmıyor.
    // Geriye dönük uyumluluk amacıyla şema üzerinde tutulurlar; bir sonraki
    // migrasyonda kolonlar tamamen drop edilebilir.
    @Deprecated
    @Column(name = "postponed_to_date")
    private LocalDate postponedToDate;

    @Deprecated
    @Column(name = "postponed_from_date")
    private LocalDate postponedFromDate;

    @Deprecated
    @Column(name = "is_postponed", nullable = false)
    private Boolean isPostponed = false;
    
    // SLA tracking (V30)
    @Column(name = "sla_due_at")
    private LocalDateTime slaDueAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "sla_status", length = 20)
    private com.tora.model.enums.SlaStatus slaStatus;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

