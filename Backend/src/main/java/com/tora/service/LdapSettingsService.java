package com.tora.service;

import com.tora.dto.LdapSettingsDTO;
import com.tora.dto.LdapTestRequest;
import com.tora.dto.LdapTestResponse;
import com.tora.dto.UpdateLdapSettingsRequest;
import com.tora.model.LdapSettings;
import com.tora.repository.LdapSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import org.springframework.ldap.filter.EqualsFilter;
import org.springframework.ldap.support.LdapUtils;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional
public class LdapSettingsService {

    private static final Logger log = LoggerFactory.getLogger(LdapSettingsService.class);
    
    @Autowired
    private LdapSettingsRepository ldapSettingsRepository;
    
    @Autowired
    private EncryptionService encryptionService;
    
    public LdapSettingsDTO getLdapSettings() {
        Optional<LdapSettings> settingsOpt = ldapSettingsRepository.findByIsEnabledTrue();
        if (settingsOpt.isEmpty()) {
            // Return default empty settings
            LdapSettingsDTO dto = new LdapSettingsDTO();
            dto.setIsEnabled(false);
            return dto;
        }
        
        LdapSettings settings = settingsOpt.get();
        return convertToDTO(settings);
    }
    
    public LdapSettingsDTO updateLdapSettings(UpdateLdapSettingsRequest request) {
        Optional<LdapSettings> existingOpt = ldapSettingsRepository.findByIsEnabledTrue();
        
        LdapSettings settings;
        if (existingOpt.isPresent()) {
            settings = existingOpt.get();
        } else {
            settings = new LdapSettings();
        }
        
        settings.setUrls(request.getUrls());
        settings.setBase(request.getBase());
        settings.setUsername(request.getUsername());
        
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            // New password provided — encrypt with current (GCM) format
            settings.setPasswordEncrypted(encryptionService.encrypt(request.getPassword()));
        } else if (settings.getPasswordEncrypted() != null && !settings.getPasswordEncrypted().startsWith("GCM:")) {
            // Existing password is in legacy ECB format — re-encrypt in GCM format (key rotation)
            try {
                String plaintext = encryptionService.decrypt(settings.getPasswordEncrypted());
                settings.setPasswordEncrypted(encryptionService.encrypt(plaintext));
                log.debug("Re-encrypted LDAP password from legacy ECB to GCM format");
            } catch (Exception e) {
                log.warn("Could not re-encrypt legacy LDAP password; leaving as-is: {}", e.getMessage());
            }
        }
        
        settings.setUserSearchBase(request.getUserSearchBase());
        settings.setUserSearchFilter(request.getUserSearchFilter());
        settings.setIsEnabled(request.getIsEnabled() != null ? request.getIsEnabled() : false);
        
        LdapSettings saved = ldapSettingsRepository.save(settings);
        return convertToDTO(saved);
    }
    
    public LdapTestResponse testLdapConnection(LdapTestRequest request) {
        try {
            // Debug logging
            log.debug("LDAP Test Connection - URL: {}, Base: {}, Username: {}", request.getUrls(), request.getBase(), request.getUsername());
            
            // Create a temporary LDAP context source for testing
            LdapContextSource testContextSource = new LdapContextSource();
            testContextSource.setUrl(request.getUrls());
            // Don't set Base DN - it interferes with lookup operations
            // Base DN will be used only for search operations if needed
            
            // Set username and password - both are required for authenticated bind
            if (request.getUsername() != null && !request.getUsername().isEmpty()) {
                testContextSource.setUserDn(request.getUsername());
            } else {
                // If no username provided, return error
                return new LdapTestResponse(false, "LDAP bağlantısı başarısız: Username (Bind DN) gereklidir.", "Username is required");
            }
            
            if (request.getPassword() != null && !request.getPassword().isEmpty()) {
                testContextSource.setPassword(request.getPassword());
            } else {
                // If no password provided, return error
                return new LdapTestResponse(false, "LDAP bağlantısı başarısız: Password gereklidir.", "Password is required");
            }
            
            // Initialize the context source after setting all properties
            testContextSource.afterPropertiesSet();
            
            // Create a temporary LDAP template
            LdapTemplate testTemplate = new LdapTemplate(testContextSource);
            
            // Test connection: First try base DN (always exists), then userSearchBase if provided
            String baseDn = request.getBase();
            String userSearchBase = request.getUserSearchBase();
            
            log.debug("LDAP Test - Attempting lookup for Base DN: {}", baseDn);
            
            // Step 1: Test base DN connection by trying to lookup first (most reliable)
            // Since Base DN is not set in context source, we use full DN for lookup
            try {
                // Try lookup with full DN - this is the most direct way to verify a DN exists
                testTemplate.lookup(LdapUtils.newLdapName(baseDn));
                log.debug("LDAP Test - Lookup successful for Base DN: {}", baseDn);
            } catch (Exception e) {
                log.debug("LDAP Test - Lookup failed, trying search: {}", e.getMessage());
                // If lookup fails, try a simple search as fallback
                try {
                    // Use search to verify the base DN exists
                    // Since Base DN is not set in context, we need to use full DN
                    testTemplate.search(
                        LdapUtils.newLdapName(baseDn),
                        "(objectClass=*)",
                        (org.springframework.ldap.core.AttributesMapper<Object>) attrs -> null
                    );
                    log.debug("LDAP Test - Search successful for Base DN: {}", baseDn);
                } catch (Exception e2) {
                    // If both fail, the base DN doesn't exist or is not accessible
                    log.debug("LDAP Test - Both lookup and search failed: {}", e2.getMessage());
                    String errorMsg = "LDAP bağlantısı başarısız: Base DN '" + baseDn + "' bulunamadı veya erişilemedi. " + 
                        "Lütfen şunları kontrol edin:\n" +
                        "1. LDAP sunucusunda bu DN'in mevcut olduğundan emin olun\n" +
                        "2. Kullanıcı adı ve şifrenin doğru olduğundan emin olun\n" +
                        "3. LDAP URL'sinin doğru olduğundan emin olun (Docker içinden: ldap://ldap-test:389)\n" +
                        "Hata: " + e2.getMessage();
                    return new LdapTestResponse(false, errorMsg, e2.getMessage());
                }
            }
            
            // Step 2: If userSearchBase is provided, test it (optional)
            String warningMessage = null;
            if (userSearchBase != null && !userSearchBase.isEmpty()) {
                log.debug("LDAP Test - Testing User Search Base: {}", userSearchBase);
                try {
                    // Try lookup first for userSearchBase
                    testTemplate.lookup(LdapUtils.newLdapName(userSearchBase));
                    log.debug("LDAP Test - User Search Base lookup successful: {}", userSearchBase);
                } catch (Exception e) {
                    // If lookup fails, try search
                    try {
                        EqualsFilter filter = new EqualsFilter("objectClass", "*");
                        testTemplate.search(
                            LdapUtils.newLdapName(userSearchBase),
                            filter.encode(),
                            (org.springframework.ldap.core.AttributesMapper<Object>) attrs -> null
                        );
                        log.debug("LDAP Test - User Search Base search successful: {}", userSearchBase);
                    } catch (Exception e2) {
                        // userSearchBase doesn't exist, but base connection is OK
                        log.debug("LDAP Test - User Search Base test failed: {}", e2.getMessage());
                        warningMessage = "LDAP bağlantısı başarılı, ancak User Search Base '" + userSearchBase + "' bulunamadı. " +
                            "Lütfen bu DN'in LDAP sunucusunda mevcut olduğundan emin olun. " +
                            "Hata: " + e2.getMessage();
                    }
                }
            }
            
            // Connection successful
            String successMessage = warningMessage != null 
                ? "LDAP bağlantısı başarılı. Uyarı: " + warningMessage
                : "LDAP bağlantısı başarılı";
            
            return new LdapTestResponse(true, successMessage, warningMessage);
            
        } catch (Exception e) {
            return new LdapTestResponse(false, "LDAP bağlantısı başarısız", e.getMessage());
        }
    }
    
    public LdapSettings getActiveLdapSettings() {
        return ldapSettingsRepository.findByIsEnabledTrue().orElse(null);
    }
    
    /**
     * Kayıtlı LDAP ayarlarıyla otomatik bağlantı testi yapar.
     * Bu metod veritabanından aktif LDAP ayarlarını alır ve kayıtlı şifreyi kullanarak test yapar.
     * Frontend'den periyodik olarak çağrılabilir.
     */
    public LdapTestResponse testLdapConnectionWithSavedPassword() {
        try {
            Optional<LdapSettings> settingsOpt = ldapSettingsRepository.findByIsEnabledTrue();
            if (settingsOpt.isEmpty()) {
                return new LdapTestResponse(false, "LDAP ayarları bulunamadı veya LDAP aktif değil", "No active LDAP settings found");
            }
            
            LdapSettings settings = settingsOpt.get();
            
            // Şifreyi decrypt et
            String password = null;
            if (settings.getPasswordEncrypted() != null && !settings.getPasswordEncrypted().isEmpty()) {
                try {
                    password = encryptionService.decrypt(settings.getPasswordEncrypted());
                } catch (Exception e) {
                    return new LdapTestResponse(false, "LDAP şifresi decrypt edilemedi", e.getMessage());
                }
            } else {
                return new LdapTestResponse(false, "LDAP şifresi bulunamadı", "Password not found");
            }
            
            // Test request oluştur
            LdapTestRequest request = new LdapTestRequest();
            request.setUrls(settings.getUrls());
            request.setBase(settings.getBase());
            request.setUsername(settings.getUsername());
            request.setPassword(password);
            request.setUserSearchBase(settings.getUserSearchBase());
            request.setUserSearchFilter(settings.getUserSearchFilter());
            
            // Mevcut test metodunu kullan
            return testLdapConnection(request);
            
        } catch (Exception e) {
            return new LdapTestResponse(false, "Otomatik LDAP bağlantı testi başarısız", e.getMessage());
        }
    }
    
    private LdapSettingsDTO convertToDTO(LdapSettings settings) {
        LdapSettingsDTO dto = new LdapSettingsDTO();
        dto.setId(settings.getId());
        dto.setUrls(settings.getUrls());
        dto.setBase(settings.getBase());
        dto.setUsername(settings.getUsername());
        // Password is never included in DTO
        dto.setUserSearchBase(settings.getUserSearchBase());
        dto.setUserSearchFilter(settings.getUserSearchFilter());
        dto.setIsEnabled(settings.getIsEnabled());
        dto.setCreatedAt(settings.getCreatedAt());
        dto.setUpdatedAt(settings.getUpdatedAt());
        return dto;
    }
}

