package com.projectspring.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProductivityDTO {
    private Long userId;
    private String userName;
    private long assigned;
    private long completed;
    private long cancelled;
    private long open;
    private long inProgress;
    private long overdue;
    private double completionRate;
}
