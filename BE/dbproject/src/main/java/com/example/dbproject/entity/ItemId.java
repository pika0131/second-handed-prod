package com.example.dbproject.entity;

import java.io.Serializable;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * Item 엔티티의 복합 기본키(Composite PK) 클래스
 *
 * JPA @IdClass 방식에서는 복합 PK를 별도 클래스로 선언해야 한다.
 * Serializable 구현과 equals/hashCode 재정의가 필수이며, Lombok으로 처리한다.
 *
 * 사용 예시:
 *   ItemId id = new ItemId("d202302618", 1L);
 *   itemRepository.findById(id);
 */
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ItemId implements Serializable {

    /** 판매자 회원번호 (Customer.cno 참조) */
    private String cno;

    /** 판매자별 상품 번호 (1씩 증가하는 시퀀스) */
    private Long itemNo;
}
