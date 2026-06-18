package com.example.dbproject.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket / STOMP 설정
 *
 * 클라이언트(React)는 SockJS + STOMP 프로토콜로 서버에 연결한다.
 *
 * 메시지 흐름:
 *   [클라이언트] → /app/chat/{roomNo}  →  ChatController.sendMessage()
 *                                      →  /topic/chat/{roomNo}  → [모든 구독자]
 *
 * 주요 경로:
 *   /ws          : SockJS 연결 엔드포인트 (클라이언트가 new SockJS('/ws') 로 접속)
 *   /app         : 클라이언트 → 서버 메시지 전송 접두사 (@MessageMapping 메서드로 라우팅)
 *   /topic       : 서버 → 클라이언트 브로드캐스트 토픽 접두사 (인메모리 브로커 사용)
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /**
     * 메시지 브로커 설정.
     * - enableSimpleBroker("/topic"): 인메모리 브로커로 /topic/** 구독을 처리
     * - setApplicationDestinationPrefixes("/app"): /app/** 경로는 @MessageMapping 컨트롤러로 전달
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    /**
     * STOMP 엔드포인트 등록.
     * - /ws 경로로 SockJS 폴백 지원 (WebSocket 미지원 환경 대비)
     * - setAllowedOriginPatterns("*"): 개발 환경 CORS 허용 (프로덕션에서는 도메인 지정 필요)
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
