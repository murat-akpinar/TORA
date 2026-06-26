package com.tora.controller;

import com.tora.dto.CreateLocalUserRequest;
import com.tora.dto.LoginRequest;
import com.tora.dto.LoginResponse;
import com.tora.dto.UserDTO;
import com.tora.model.User;
import com.tora.repository.UserRepository;
import com.tora.service.JwtService;
import com.tora.service.LdapAuthService;
import com.tora.service.LoginAttemptService;
import com.tora.service.RefreshTokenService;
import com.tora.service.TokenBlacklistService;
import com.tora.service.UserDetailsServiceImpl;
import com.tora.service.UserService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    
    @Autowired
    private LdapAuthService ldapAuthService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private LoginAttemptService loginAttemptService;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private UserDetailsServiceImpl userDetailsServiceImpl;
    
    private String getClientIpAddress(HttpServletRequest request) {
        // Security: do NOT trust the client-supplied X-Forwarded-For (its first
        // element is attacker-controlled, allowing rate-limit / lockout bypass).
        // The reverse proxy (nginx) sets X-Real-IP = $remote_addr — a single,
        // non-spoofable value — so prefer it, then fall back to the socket address.
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIpAddress(httpRequest);
        String username = request.getUsername();
        
        logger.info("Login attempt for user: {} from IP: {}", username, ipAddress);
        
        // Check IP-based rate limiting
        boolean ipBlocked = loginAttemptService.isIpBlocked(ipAddress);
        logger.debug("Rate limiting check for IP {}: blocked={}", ipAddress, ipBlocked);
        if (ipBlocked) {
            logger.warn("IP blocked for login attempt: {} from IP: {}", username, ipAddress);
            loginAttemptService.recordLoginAttempt(username, ipAddress, false);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Too many login attempts from this IP. Please try again later.");
            error.put("code", "RATE_LIMIT_EXCEEDED");
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(error);
        }
        
        // Check account lockout
        boolean accountLocked = loginAttemptService.isAccountLocked(username);
        logger.debug("Account lockout check for user {}: locked={}", username, accountLocked);
        if (accountLocked) {
            logger.warn("Account locked for login attempt: {}", username);
            loginAttemptService.recordLoginAttempt(username, ipAddress, false);
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Account is temporarily locked due to too many failed login attempts. Please try again later.");
            error.put("code", "ACCOUNT_LOCKED");
            return ResponseEntity.status(HttpStatus.LOCKED).body(error);
        }
        
        try {
            String loginType = request.getLoginType();
            logger.info("Attempting authentication for user: {} with loginType: {}", username, loginType != null ? loginType : "auto");
            String token = ldapAuthService.authenticate(username, request.getPassword(), loginType);
            logger.info("Authentication successful for user: {}", username);
            
            // Record successful login
            loginAttemptService.recordLoginAttempt(username, ipAddress, true);
            
            User user = userRepository.findByUsernameWithRolesAndTeams(username)
                .orElseThrow(() -> new RuntimeException("User not found after successful authentication"));
            
            UserDTO userDTO = new UserDTO();
            userDTO.setId(user.getId());
            userDTO.setUsername(user.getUsername());
            userDTO.setEmail(user.getEmail());
            userDTO.setFullName(user.getFullName());
            userDTO.setRoles(user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toSet()));
            userDTO.setTeamIds(user.getTeams().stream()
                .map(t -> t.getId())
                .collect(Collectors.toSet()));
            
            String refreshToken = refreshTokenService.createRefreshToken(
                    username, ipAddress, httpRequest.getHeader("User-Agent"));

            LoginResponse response = new LoginResponse();
            response.setToken(token);
            response.setRefreshToken(refreshToken);
            response.setUser(userDTO);

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            // Handle specific authentication errors
            String errorMessage = e.getMessage();
            logger.error("Authentication failed for user: {} from IP: {} - Error: {} (Type: {})", 
                username, ipAddress, errorMessage, e.getClass().getSimpleName(), e);
            
            // Record failed login
            loginAttemptService.recordLoginAttempt(username, ipAddress, false);
            
            int remainingAttempts = loginAttemptService.getRemainingAttempts(username);
            Map<String, Object> error = new HashMap<>();

            // Security: return one identical response for every credential failure
            // (unknown user, wrong password, LDAP failure) so the response cannot be
            // used to enumerate valid usernames. The specific cause is only logged
            // server-side above.
            error.put("error", "Invalid username or password");
            error.put("code", "AUTHENTICATION_FAILED");

            if (remainingAttempts < 5) {
                error.put("remainingAttempts", remainingAttempts);
            }

            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        } catch (Exception e) {
            // Handle unexpected errors
            logger.error("Unexpected error during login for user: {} from IP: {} - Error: {}", 
                username, ipAddress, e.getMessage(), e);
            
            // Record failed login
            loginAttemptService.recordLoginAttempt(username, ipAddress, false);
            
            Map<String, Object> error = new HashMap<>();
            error.put("error", "An error occurred during authentication. Please try again later.");
            error.put("code", "INTERNAL_SERVER_ERROR");
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body, HttpServletRequest httpRequest) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "refreshToken is required"));
        }
        String username = refreshTokenService.getUsernameForToken(refreshToken);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Refresh token expired or invalid"));
        }
        try {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            String newAccessToken = jwtService.generateToken(userDetails);
            // Rotate refresh token — invalidate old, issue new
            refreshTokenService.invalidate(refreshToken);
            String newRefreshToken = refreshTokenService.createRefreshToken(
                    username, getClientIpAddress(httpRequest), httpRequest.getHeader("User-Agent"));
            return ResponseEntity.ok(Map.of("token", newAccessToken, "refreshToken", newRefreshToken));
        } catch (Exception e) {
            logger.error("Failed to refresh token for user {}: {}", username, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Could not issue new token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest, @RequestBody(required = false) Map<String, String> body) {
        String authHeader = httpRequest.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            tokenBlacklistService.blacklistToken(token);
            logger.info("Token blacklisted on logout for request from {}", getClientIpAddress(httpRequest));
            try {
                String username = jwtService.extractUsername(token);
                if (username != null) {
                    userDetailsServiceImpl.evictUserCache(username);
                }
            } catch (Exception ignored) {}
        }
        if (body != null && body.containsKey("refreshToken")) {
            refreshTokenService.invalidate(body.get("refreshToken"));
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        
        User user = userRepository.findByUsernameWithRolesAndTeams(username)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        UserDTO userDTO = new UserDTO();
        userDTO.setId(user.getId());
        userDTO.setUsername(user.getUsername());
        userDTO.setEmail(user.getEmail());
        userDTO.setFullName(user.getFullName());
        userDTO.setRoles(user.getRoles().stream()
            .map(r -> r.getName())
            .collect(Collectors.toSet()));
        userDTO.setTeamIds(user.getTeams().stream()
            .map(t -> t.getId())
            .collect(Collectors.toSet()));
        userDTO.setIsActive(user.getIsActive());
        
        return ResponseEntity.ok(userDTO);
    }
    
    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserDTO> createLocalUser(@Valid @RequestBody CreateLocalUserRequest request) {
        User user = userService.createLocalUser(
            request.getUsername(),
            request.getEmail(),
            request.getFullName(),
            request.getPassword(),
            request.getRole()
        );
        
        UserDTO userDTO = new UserDTO();
        userDTO.setId(user.getId());
        userDTO.setUsername(user.getUsername());
        userDTO.setEmail(user.getEmail());
        userDTO.setFullName(user.getFullName());
        userDTO.setRoles(user.getRoles().stream()
            .map(r -> r.getName())
            .collect(Collectors.toSet()));
        userDTO.setTeamIds(user.getTeams().stream()
            .map(t -> t.getId())
            .collect(Collectors.toSet()));
        userDTO.setIsActive(user.getIsActive());
        
        return ResponseEntity.ok(userDTO);
    }
    
    @GetMapping("/users")
    public ResponseEntity<List<com.tora.dto.SimpleUserDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }
}

