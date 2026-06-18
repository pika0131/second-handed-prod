package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/**
 * 관리자 알림 메시지(AdminMsg) 엔티티
 *
 * 관리자가 상품을 강제 삭제하거나 "검토 중" 상태로 변경할 때
 * 판매자에게 보내는 알림 내용을 저장한다.
 *
 * reason 필드의 접두사로 알림 유형을 구분한다:
 *   - "[검토 중] ..." → 검토 안내 알림 (보라색 UI)
 *   - 접두사 없음    → 상품 강제 삭제 알림 (빨간색 UI)
 *
 * 프론트엔드 ChatListPage에서 isRead 값을 기준으로 읽음/안읽음 배지를 표시한다.
 */
@Entity
@Table(name = "ADMIN_MSG")
@Getter
@Setter
public class AdminMsg {

    /** 알림 ID (자동 증가 PK) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MSGID")
    private Long msgId;

    /** 알림을 받을 판매자 회원번호 (Customer.cno 참조) */
    @Column(name = "SELLERCNO", nullable = false, length = 10)
    private String sellerCno;

    /** 삭제되거나 검토 중으로 변경된 상품 제목 (상품이 삭제되어도 이름을 표시하기 위해 저장) */
    @Column(name = "ITEMTITLE", nullable = false, length = 300)
    private String itemTitle;

    /**
     * 처리 사유 (관리자 입력값).
     * 검토 알림인 경우 "[검토 중] " 접두사가 붙는다.
     */
    @Column(name = "REASON", nullable = false, length = 2000)
    private String reason;

    /** 알림 전송 일시 */
    @Column(name = "SENTAT", nullable = false)
    private LocalDateTime sentAt;

    /**
     * 읽음 여부
     * "Y" = 읽음, "N" = 안읽음
     * 판매자가 "확인" 버튼을 누르면 AdminController.markRead()가 "Y"로 갱신한다.
     */
    @Column(name = "ISREAD", nullable = false, length = 1)
    private String isRead;
}
