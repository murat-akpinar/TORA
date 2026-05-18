package com.tora.repository;

import com.tora.model.SavedFilter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedFilterRepository extends JpaRepository<SavedFilter, Long> {
    List<SavedFilter> findByUserIdOrderByCreatedAtDesc(Long userId);
}
