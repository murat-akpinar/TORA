package com.tora.config;

import com.tora.security.JwtAuthenticationEntryPoint;
import com.tora.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);

    @Autowired
    private UserDetailsService userDetailsService;
    
    @Autowired
    private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    
    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    
    @Bean
    public AuthenticationManager authenticationManager() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return new ProviderManager(authProvider);
    }
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(cto -> {})
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000))
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"))
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/auth/refresh").permitAll()
                .requestMatchers("/health").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // Git webhook: dis git sunucusundan JWT gelmez; imza ile dogrulanir
                .requestMatchers("/api/webhooks/git/**").permitAll()
                // Swagger/OpenAPI: erişim Nginx IP allowlist ile sınırlanır (asıl kapı orada).
                // UI'ın açılışta yaptığı spec fetch'ine token eklenemediği için Spring tarafında
                // permitAll; bu yollara yalnızca allowlist'teki IP'ler ulaşır. Operasyonlar yine
                // Authorize'a girilen ADMIN JWT + ilgili @PreAuthorize ile korunur.
                // springdoc tüm doküman yollarını '/api' öneki altında sunar
                // (UI: /api/swagger-ui/**, spec: /api/v3/api-docs/**).
                .requestMatchers(
                    "/api/docs", "/api/docs/**",
                    "/api/v3/api-docs/**",
                    "/api/swagger-ui/**",
                    "/api/webjars/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
    
    @Value("${app.cors.allowed-origins:*}")
    private String allowedOrigins;

    @Value("${ENFORCE_SECRET_VALIDATION:true}")
    private boolean enforceSecretValidation;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Parse allowed origins from configuration
        if ("*".equals(allowedOrigins.trim())) {
            // Wildcard origins are permissive but NOT a vulnerability here:
            // credentials are disabled (see below) and authentication requires a
            // bearer token in the Authorization header, which a cross-origin site
            // cannot obtain. In production we strongly recommend an explicit
            // origin list, so warn loudly rather than reflecting every origin
            // silently.
            if (enforceSecretValidation) {
                logger.warn("CORS_ALLOWED_ORIGINS is '*' while ENFORCE_SECRET_VALIDATION=true. " +
                    "Set an explicit origin list (e.g. https://your-domain) in production.");
            }
            configuration.setAllowedOriginPatterns(List.of("*"));
        } else {
            // Production mode: specific origins
            List<String> origins = Arrays.asList(allowedOrigins.split(","));
            configuration.setAllowedOrigins(origins.stream()
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList());
        }

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setExposedHeaders(Arrays.asList("Authorization"));
        // Authentication is carried in the Authorization header (bearer tokens),
        // not cookies, so credentialed CORS is unnecessary. Disabling it also
        // avoids the unsafe "reflect any origin + allow credentials" combination.
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

