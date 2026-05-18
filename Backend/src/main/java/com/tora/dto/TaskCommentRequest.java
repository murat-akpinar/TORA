package com.tora.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskCommentRequest {
    @NotBlank(message = "Yorum içeriği boş olamaz")
    @Size(max = 5000, message = "Yorum 5000 karakteri geçemez")
    private String content;
}
