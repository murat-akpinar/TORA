package com.tora.service;

import com.tora.model.Task;
import com.tora.model.TaskComment;
import com.tora.model.User;
import com.tora.repository.TaskCommentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskCommentServiceSystemTest {

    @Mock TaskCommentRepository commentRepository;
    @Mock NotificationService notificationService;
    @InjectMocks TaskCommentService service;

    @Test
    void createSystemComment_savesWithGivenAuthorAndNotifies() {
        Task task = new Task();
        task.setId(7L);
        User actor = new User();
        actor.setId(3L);
        actor.setUsername("ada");

        when(commentRepository.save(any(TaskComment.class)))
            .thenAnswer(inv -> inv.getArgument(0));

        TaskComment saved = service.createSystemComment(task, "git ile eklendi", actor);

        assertEquals("git ile eklendi", saved.getContent());
        assertEquals(actor, saved.getAuthor());
        assertEquals(task, saved.getTask());
        verify(commentRepository).save(any(TaskComment.class));
        verify(notificationService).notifyNewComment(any(TaskComment.class));
    }
}
