package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/**
 * 채팅 메시지(ChatMessage) 엔티티
 *
 * MESSAGE 테이블에 매핑되며, 각 행이 채팅방 내 개별 메시지 하나를 나타낸다.
 * content 필드에는 일반 텍스트 외에도 JSON 형태의 시스템 메시지가 저장될 수 있다.
 *   - {"type":"FINAL_PRICE", ...}   : 판매자의 최종 가격 제안 카드
 *   - {"type":"REJECT_NOTICE", ...} : 구매 요청 거절/취소 알림 카드
 *   - "판매자가 요청을 수락했어요."  : 수락 알림 (고정 문자열)
 */
@Entity
@Table(name = "MESSAGE")
@Getter
@Setter
public class ChatMessage {

    /** 메시지 시퀀스 번호 (자동 증가 PK) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SEQNO")
    private Long seqNo;

    /** 소속 채팅방 번호 (ChatRoom.roomNo 참조) */
    @Column(name = "ROOMNO", nullable = false)
    private Long roomNo;

    /**
     * 발신자 구분
     * "S" = Seller(판매자), "B" = Buyer(구매자)
     */
    @Column(name = "SENDER", length = 1, nullable = false)
    private String sender;

    /** 메시지 전송 일시 */
    @Column(name = "SENTDATETIME")
    private LocalDateTime sentDatetime;

    /** 메시지 본문 (일반 텍스트 또는 JSON 시스템 메시지, 최대 2000자) */
    @Column(name = "CONTENT", length = 2000, nullable = false)
    private String content;

    /**
     * 읽음 여부
     * "Y" = 읽음, "N" = 안읽음
     * 채팅방 입장 시 ChatMessageRepository.markAsRead()로 일괄 처리된다.
     */
    @Column(name = "ISREAD", length = 1)
    private String isRead;
}
