package com.tora.repository;

import com.tora.model.TaskChain;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskChainRepository extends JpaRepository<TaskChain, Long> {
    List<TaskChain> findBySourceId(Long sourceId);
}
