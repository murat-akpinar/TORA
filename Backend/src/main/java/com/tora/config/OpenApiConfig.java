package com.tora.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("dev")
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI toraOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("TORA API")
                        .description("Takımlar için takvim odaklı proje ve görev yönetim platformu — REST API. "
                                + "Erişim ADMIN rolüyle sınırlıdır. `Authorize` butonuna `/api/auth/login` "
                                + "ile alınan JWT'yi girerek endpoint'leri deneyebilirsiniz.")
                        .version("1.0.0")
                        .license(new License().name("Proprietary")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SCHEME, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT bearer token (`Authorization: Bearer <token>`)")));
    }
}
