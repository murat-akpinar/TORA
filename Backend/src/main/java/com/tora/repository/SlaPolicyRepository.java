package com.tora.repository;

import com.tora.model.SlaPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SlaPolicyRepository extends JpaRepository<SlaPolicy, Long> {
    List<SlaPolicy> findByIsActiveTrue();
}
