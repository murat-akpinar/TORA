package com.tora.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache("dashboardStats",
                Caffeine.newBuilder().expireAfterWrite(5, TimeUnit.MINUTES).maximumSize(200).build());
        manager.registerCustomCache("dashboardDetails",
                Caffeine.newBuilder().expireAfterWrite(5, TimeUnit.MINUTES).maximumSize(200).build());
        // Her istek başına DB'ye giden userDetails yükünü azaltır (5 dk TTL)
        manager.registerCustomCache("userDetails",
                Caffeine.newBuilder().expireAfterWrite(5, TimeUnit.MINUTES).maximumSize(500).build());
        return manager;
    }
}
