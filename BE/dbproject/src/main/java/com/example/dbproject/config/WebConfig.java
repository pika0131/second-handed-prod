package com.example.dbproject.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Spring MVC 웹 리소스 설정
 *
 * 로컬 파일 시스템의 업로드 디렉터리를 정적 리소스로 서빙하기 위한 핸들러를 등록한다.
 * 현재는 이미지를 BLOB(DB)에 저장하므로 이 핸들러가 직접 사용되지 않을 수 있으나,
 * 추후 파일 시스템 업로드 방식으로 전환할 때 활용할 수 있다.
 *
 * application.properties에서 업로드 경로를 설정한다:
 *   app.upload.dir=uploads    (기본값, 프로젝트 루트 기준 상대 경로)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /** 파일 업로드 디렉터리 경로 (기본값: "uploads") */
    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    /**
     * /uploads/** 요청을 로컬 파일 시스템의 uploadDir 경로로 연결한다.
     * 절대 경로로 변환해 OS와 무관하게 동작한다.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadPath + "/");
    }
}
