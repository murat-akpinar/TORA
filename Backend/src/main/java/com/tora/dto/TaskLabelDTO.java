package com.tora.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskLabelDTO {
    private Long id;
    private String name;
    private String color;
    private Long teamId;
}
