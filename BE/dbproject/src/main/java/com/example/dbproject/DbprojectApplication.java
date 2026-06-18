package com.example.dbproject;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 동네장터 Spring Boot 애플리케이션 진입점
 *
 * @SpringBootApplication : 컴포넌트 스캔, 자동 설정(Auto-Configuration), 설정 클래스 역할을 한 번에 수행
 * @EnableScheduling      : ItemCleanupScheduler의 @Scheduled 어노테이션이 동작하도록 스케줄링 활성화
 *
 * 실행 후 기본 포트: 8080
 * 프론트엔드(Vite, 5173)의 Vite 프록시를 통해 /api/** 요청이 이 서버로 전달된다.
 */
@SpringBootApplication
@EnableScheduling
public class DbprojectApplication {

    public static void main(String[] args) {
        SpringApplication.run(DbprojectApplication.class, args);
    }
}
