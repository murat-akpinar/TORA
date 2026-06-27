package com.tora.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.tora.dto.ChangePasswordRequest;
import com.tora.dto.SessionDTO;
import com.tora.dto.TaskDTO;
import com.tora.dto.UserWithTasksDTO;
import com.tora.model.LoginAttempt;
import com.tora.model.User;
import com.tora.repository.LoginAttemptRepository;
import com.tora.repository.TaskRepository;
import com.tora.repository.UserRepository;
import com.tora.service.RefreshTokenService;
import com.tora.service.TaskService;
import com.tora.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users/me")
@Tag(name = "Kullanıcı Profili & Oturumlar", description = "Profil, şifre değiştirme, aktif oturum yönetimi")
public class UserProfileController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskService taskService;

    @Autowired
    private UserService userService;

    @Autowired
    private LoginAttemptRepository loginAttemptRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @GetMapping("/sessions")
    public ResponseEntity<List<SessionDTO>> getSessions(
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshToken) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return ResponseEntity.ok(refreshTokenService.getActiveSessions(username, refreshToken));
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> revokeSession(@PathVariable Long id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        boolean revoked = refreshTokenService.revokeSession(username, id);
        return revoked ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PostMapping("/sessions/logout-others")
    public ResponseEntity<Map<String, Object>> logoutOtherSessions(
            @RequestHeader(value = "X-Refresh-Token", required = false) String refreshToken) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        long removed = refreshTokenService.logoutOtherSessions(username, refreshToken);
        return ResponseEntity.ok(Map.of("removed", removed));
    }

    @GetMapping("/login-history")
    public ResponseEntity<List<Map<String, Object>>> getLoginHistory() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        List<LoginAttempt> attempts = loginAttemptRepository
                .findTop10ByUsernameOrderByAttemptTimeDesc(username, PageRequest.of(0, 10));
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        List<Map<String, Object>> result = attempts.stream().map(a -> Map.<String, Object>of(
                "ipAddress", a.getIpAddress(),
                "attemptTime", a.getAttemptTime().format(fmt),
                "success", a.getSuccess()
        )).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/tasks")
    public ResponseEntity<List<TaskDTO>> getMyTasks() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Get all tasks assigned to this user
            List<TaskDTO> allTasks = taskService.getTasks(null, null, null, null);
            List<TaskDTO> tasks = allTasks.stream()
                    .filter(task -> task.getAssigneeIds() != null && task.getAssigneeIds().contains(user.getId()))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> request) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            String fullName = request.get("fullName");
            if (fullName != null && !fullName.trim().isEmpty()) {
                userService.updateProfile(user.getId(), fullName);
                return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Full name is required"));
            }
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update profile"));
        }
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String username = authentication.getName();
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            userService.changePassword(user.getId(), request.getOldPassword(), request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to change password"));
        }
    }
}

