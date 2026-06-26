package com.tora.controller;

import com.tora.dto.LdapSettingsDTO;
import com.tora.dto.LdapTestRequest;
import com.tora.dto.LdapTestResponse;
import com.tora.dto.UpdateLdapSettingsRequest;
import com.tora.service.LdapSettingsService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/ldap/settings")
@PreAuthorize("hasAnyRole('ADMIN')")
public class LdapSettingsController {

    private static final Logger logger = LoggerFactory.getLogger(LdapSettingsController.class);

    @Autowired
    private LdapSettingsService ldapSettingsService;
    
    @GetMapping
    public ResponseEntity<LdapSettingsDTO> getLdapSettings() {
        try {
            LdapSettingsDTO settings = ldapSettingsService.getLdapSettings();
            return ResponseEntity.ok(settings);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    @PutMapping
    public ResponseEntity<?> updateLdapSettings(@Valid @RequestBody UpdateLdapSettingsRequest request) {
        try {
            LdapSettingsDTO settings = ldapSettingsService.updateLdapSettings(request);
            return ResponseEntity.ok(settings);
        } catch (Exception e) {
            // Log the detail server-side; return a generic message so internal
            // exception text (DNs, connection details) is not leaked to the client.
            logger.error("LDAP ayarları güncellenemedi", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Map.of("error", "LDAP ayarları güncellenemedi. Ayrıntılar sunucu loglarında."));
        }
    }

    @PostMapping("/test")
    public ResponseEntity<LdapTestResponse> testLdapConnection(@Valid @RequestBody LdapTestRequest request) {
        try {
            LdapTestResponse response = ldapSettingsService.testLdapConnection(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("LDAP bağlantı testi başarısız", e);
            LdapTestResponse errorResponse = new LdapTestResponse(false, "Test başarısız",
                    "Bağlantı kurulamadı. Ayrıntılar sunucu loglarında.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @PostMapping("/test/auto")
    public ResponseEntity<LdapTestResponse> testLdapConnectionAuto() {
        try {
            LdapTestResponse response = ldapSettingsService.testLdapConnectionWithSavedPassword();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Otomatik LDAP bağlantı testi başarısız", e);
            LdapTestResponse errorResponse = new LdapTestResponse(false, "Otomatik test başarısız",
                    "Bağlantı kurulamadı. Ayrıntılar sunucu loglarında.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}

