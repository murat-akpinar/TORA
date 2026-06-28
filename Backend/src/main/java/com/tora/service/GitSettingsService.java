package com.tora.service;

import com.tora.dto.GitSettingsDTO;
import com.tora.dto.UpdateGitSettingsRequest;
import com.tora.model.GitSettings;
import com.tora.repository.GitSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GitSettingsService {

    private final GitSettingsRepository repository;
    private final EncryptionService encryptionService;

    public GitSettingsService(GitSettingsRepository repository, EncryptionService encryptionService) {
        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    @Transactional(readOnly = true)
    public GitSettingsDTO getSettings() {
        return toDTO(getActiveSettings());
    }

    @Transactional
    public GitSettingsDTO updateSettings(UpdateGitSettingsRequest req) {
        GitSettings s = getActiveSettings();
        if (req.getEnabled() != null) s.setIsEnabled(req.getEnabled());
        // bos gonderim → mevcut secret korunur
        if (req.getWebhookSecret() != null && !req.getWebhookSecret().isBlank()) {
            s.setWebhookSecretEncrypted(encryptionService.encrypt(req.getWebhookSecret().trim()));
        }
        s.setMrOpenedStatus(normalize(req.getMrOpenedStatus()));
        s.setMrMergedStatus(normalize(req.getMrMergedStatus()));
        s.setBranchStatus(normalize(req.getBranchStatus()));
        return toDTO(repository.save(s));
    }

    @Transactional
    public GitSettings getActiveSettings() {
        return repository.findTopByOrderByIdAsc().orElseGet(() -> {
            GitSettings s = new GitSettings();
            s.setIsEnabled(false);
            return repository.save(s);
        });
    }

    public String getDecryptedSecret() {
        String enc = getActiveSettings().getWebhookSecretEncrypted();
        return (enc == null || enc.isBlank()) ? null : encryptionService.decrypt(enc);
    }

    private String normalize(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    private GitSettingsDTO toDTO(GitSettings s) {
        GitSettingsDTO dto = new GitSettingsDTO();
        dto.setEnabled(Boolean.TRUE.equals(s.getIsEnabled()));
        dto.setSecretConfigured(s.getWebhookSecretEncrypted() != null && !s.getWebhookSecretEncrypted().isBlank());
        dto.setMrOpenedStatus(s.getMrOpenedStatus());
        dto.setMrMergedStatus(s.getMrMergedStatus());
        dto.setBranchStatus(s.getBranchStatus());
        return dto;
    }
}
