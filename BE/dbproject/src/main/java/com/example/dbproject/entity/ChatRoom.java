package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/**
 * 채팅방(ChatRoom) 엔티티
 *
 * 하나의 채팅방은 (판매자, 구매자, 상품) 조합으로 유일하게 식별된다.
 * DB에는 UNIQUE 제약이 걸려 있으며, ChatController에서도 중복 생성을 방지한다.
 *
 * ⚠ 필드 명칭 주의:
 *   - cno       = 판매자(Seller) 회원번호 — FK_CHAT_ITEM 제약으로 ITEM(CNO, ITEMNO) 참조
 *   - receiveCno = 구매자(Buyer) 회원번호
 * 이름이 직관적이지 않으므로, 역할 구분 시 반드시 위 정의를 따른다.
 */
@Entity
@Table(name = "CHATROOM")
@Getter
@Setter
public class ChatRoom {

    /** 채팅방 번호 (자동 증가 PK) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ROOMNO")
    private Long roomNo;

    /** 판매자 회원번호 (FK: ITEM.CNO) */
    @Column(name = "CNO", length = 10)
    private String cno;

    /** 구매자 회원번호 */
    @Column(name = "RECEIVECNO", length = 10)
    private String receiveCno;

    /** 채팅 대상 상품 번호 */
    @Column(name = "ITEMNO")
    private Long itemNo;

    /** 채팅방 생성 일시 */
    @Column(name = "CREATEDATETIME")
    private LocalDateTime createDatetime;
}
