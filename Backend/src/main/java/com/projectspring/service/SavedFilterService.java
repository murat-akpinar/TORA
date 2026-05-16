package com.projectspring.service;

import com.projectspring.dto.CreateSavedFilterRequest;
import com.projectspring.dto.SavedFilterDTO;
import com.projectspring.model.SavedFilter;
import com.projectspring.model.User;
import com.projectspring.repository.SavedFilterRepository;
import com.projectspring.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class SavedFilterService {

    private static final int MAX_SAVED_FILTERS_PER_USER = 20;

    @Autowired
    private SavedFilterRepository savedFilterRepository;

    @Autowired
    private UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<SavedFilterDTO> getMyFilters() {
        User currentUser = getCurrentUser();
        return savedFilterRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public SavedFilterDTO create(CreateSavedFilterRequest request) {
        User currentUser = getCurrentUser();

        long count = savedFilterRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId()).size();
        if (count >= MAX_SAVED_FILTERS_PER_USER) {
            throw new RuntimeException("En fazla " + MAX_SAVED_FILTERS_PER_USER + " filtre kaydedebilirsiniz");
        }

        SavedFilter filter = new SavedFilter();
        filter.setUser(currentUser);
        filter.setName(request.getName().trim());
        filter.setFilterJson(request.getFilterJson());

        return toDTO(savedFilterRepository.save(filter));
    }

    public void delete(Long id) {
        User currentUser = getCurrentUser();
        SavedFilter filter = savedFilterRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Filtre bulunamadı"));

        if (!filter.getUser().getId().equals(currentUser.getId())) {
            throw new RuntimeException("Bu filtreyi silemezsiniz");
        }
        savedFilterRepository.delete(filter);
    }

    private SavedFilterDTO toDTO(SavedFilter f) {
        return new SavedFilterDTO(f.getId(), f.getName(), f.getFilterJson(), f.getCreatedAt());
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
