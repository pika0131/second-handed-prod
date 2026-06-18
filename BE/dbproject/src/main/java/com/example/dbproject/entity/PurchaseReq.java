package com.example.dbproject.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/**
 * 구매 요청(PurchaseReq) 엔티티
 *
 * 구매자(requestCno)가 특정 상품(cno + itemNo)에 보내는 구매 요청을 저장한다.
 * (requestCno, cno, itemNo) 세 필드가 복합 PK이므로, 같은 구매자가 같은 상품에
 * 중복 요청을 보낼 수 없다 (PurchaseReqController에서도 existsById로 이중 확인).
 *
 * 판매자가 승인하면 해당 상품은 "예약 중"으로 변경되고,
 * 나머지 요청들은 자동으로 일괄 삭제된다 (approveRequest 참고).
 */
@Entity
@Table(name = "PURCHASEREQ")
@IdClass(PurchaseReqId.class)
@Getter
@Setter
public class PurchaseReq {

    // ── 복합 PK ─────────────────────────────────────────────────
    /** 구매 요청을 보낸 회원번호 (구매자) */
    @Id
    @Column(name = "REQUESTCNO", length = 10)
    private String requestCno;

    /** 상품 판매자 회원번호 (Item.cno 참조) */
    @Id
    @Column(name = "CNO", length = 10)
    private String cno;

    /** 요청 대상 상품 번호 (Item.itemNo 참조) */
    @Id
    @Column(name = "ITEMNO")
    private Long itemNo;

    // ── 요청 정보 ────────────────────────────────────────────────
    /** 구매 요청 전송 일시 */
    @Column(name = "REQDATETIME")
    private LocalDateTime reqDateTime;

    /** 구매자가 제시한 희망 구매 가격 (원) */
    @Column(name = "REQPRICE")
    private Long reqPrice;

    /** 판매자에게 전달할 메시지 (선택 항목, 최대 1000자) */
    @Column(name = "REQMESSAGE", length = 1000)
    private String reqMessage;
}
