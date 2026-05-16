package com.projectspring.service;

import com.projectspring.model.Task;
import com.projectspring.model.enums.TaskStatus;
import com.projectspring.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

/**
 * Her sabah 08:00'da çalışıp bitiş tarihi yarın olan ve henüz tamamlanmamış
 * işlerin atanan kullanıcılarına "TASK_DUE_SOON" bildirimi üretir.
 */
@Service
public class TaskDueSoonNotifier {

    private static final Logger log = LoggerFactory.getLogger(TaskDueSoonNotifier.class);

    private static final List<TaskStatus> EXCLUDED_STATUSES =
            Arrays.asList(TaskStatus.COMPLETED, TaskStatus.CANCELLED);

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private NotificationService notificationService;

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void notifyTasksDueTomorrow() {
        LocalDate target = LocalDate.now().plusDays(1);
        List<Task> tasks = taskRepository.findByEndDateAndStatusNotIn(target, EXCLUDED_STATUSES);
        if (tasks.isEmpty()) {
            log.debug("Yarın bitiş tarihi olan iş yok ({})", target);
            return;
        }
        log.info("{} adet iş için 'son tarih yaklaşıyor' bildirimi üretiliyor (target={})", tasks.size(), target);
        for (Task task : tasks) {
            try {
                notificationService.notifyDueSoon(task);
            } catch (Exception ex) {
                log.warn("Görev için son tarih bildirimi üretilemedi (taskId={}): {}", task.getId(), ex.getMessage());
            }
        }
    }
}
