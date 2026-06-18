package com.example.dbproject.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * PurchaseReq 엔티티의 복합 기본키(Composite PK) 클래스
 *
 * 구매 요청은 (구매자, 판매자, 상품) 세 값으로 유일하게 식별된다.
 * JPA @IdClass 방식에 따라 Serializable을 구현하고 equals/hashCode를 재정의해야 한다.
 *
 * 사용 예시:
 *   PurchaseReqId id = new PurchaseReqId("buyer01", "seller01", 3L);
 *   purchaseReqRepository.existsById(id);
 */
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PurchaseReqId implements Serializable {

    /** 구매 요청을 보낸 회원번호 (구매자) */
    private String requestCno;

    /** 상품 판매자 회원번호 */
    private String cno;

    /** 요청 대상 상품 번호 */
    private Long itemNo;
}
