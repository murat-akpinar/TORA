package com.tora.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

@Service
public class EncryptionService {

    private static final Logger logger = LoggerFactory.getLogger(EncryptionService.class);
    private static final String DEFAULT_ENCRYPTION_KEY = "default-encryption-key-change-in-production-min-32-chars-long";
    private static final String GCM_PREFIX = "GCM:";
    private static final String AES_GCM_ALGO = "AES/GCM/NoPadding";
    private static final String PBKDF2_ALGO = "PBKDF2WithHmacSHA256";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final int PBKDF2_ITERATIONS = 65536;
    private static final int PBKDF2_KEY_LENGTH = 256;
    private static final String DEFAULT_KDF_SALT = "Tora-v2";

    @Value("${app.encryption.key:default-encryption-key-change-in-production-min-32-chars-long}")
    private String encryptionKey;

    @Value("${app.encryption.salt:Tora-v2}")
    private String kdfSalt;

    @Value("${ENFORCE_SECRET_VALIDATION:true}")
    private boolean enforceSecretValidation;

    @PostConstruct
    public void validateEncryptionKey() {
        if (DEFAULT_ENCRYPTION_KEY.equals(encryptionKey)) {
            String msg = "CRITICAL: ENCRYPTION_KEY is set to the known default value. " +
                         "Stored LDAP credentials can be decrypted by anyone who knows this key. " +
                         "Set ENCRYPTION_KEY to a strong random value (min 32 chars). " +
                         "To skip this check (dev only) set ENFORCE_SECRET_VALIDATION=false";
            logger.error(msg);
            if (enforceSecretValidation) throw new IllegalStateException(msg);
        }
    }

    private SecretKey deriveKey() throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance(PBKDF2_ALGO);
        byte[] salt = kdfSalt.getBytes(StandardCharsets.UTF_8);
        KeySpec spec = new PBEKeySpec(encryptionKey.toCharArray(), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH);
        byte[] keyBytes = factory.generateSecret(spec).getEncoded();
        return new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(AES_GCM_ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, deriveKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // Layout: IV (12 bytes) || ciphertext+tag
            byte[] combined = new byte[GCM_IV_LENGTH + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, GCM_IV_LENGTH);
            System.arraycopy(cipherText, 0, combined, GCM_IV_LENGTH, cipherText.length);

            return GCM_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return null;
        }
        try {
            if (encryptedText.startsWith(GCM_PREFIX)) {
                return decryptGcm(encryptedText.substring(GCM_PREFIX.length()));
            } else {
                return decryptLegacyEcb(encryptedText);
            }
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }

    private String decryptGcm(String base64Data) throws Exception {
        byte[] combined = Base64.getDecoder().decode(base64Data);
        byte[] iv = new byte[GCM_IV_LENGTH];
        byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
        System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
        System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

        Cipher cipher = Cipher.getInstance(AES_GCM_ALGO);
        cipher.init(Cipher.DECRYPT_MODE, deriveKey(), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }

    /** Backward-compat decrypt for values stored with the old AES/ECB mode. */
    private String decryptLegacyEcb(String encryptedText) throws Exception {
        byte[] rawKey = encryptionKey.getBytes(StandardCharsets.UTF_8);
        byte[] normalizedKey = new byte[32];
        System.arraycopy(rawKey, 0, normalizedKey, 0, Math.min(rawKey.length, 32));
        SecretKey key = new SecretKeySpec(normalizedKey, "AES");

        Cipher cipher = Cipher.getInstance("AES");
        cipher.init(Cipher.DECRYPT_MODE, key);
        byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
        return new String(decrypted, StandardCharsets.UTF_8);
    }
}
