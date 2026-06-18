package com.example.dbproject.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

/**
 * 상품(Item) 엔티티
 *
 * (cno, itemNo)로 구성된 복합 PK를 사용한다.
 * itemNo는 같은 판매자(cno) 내에서 1씩 증가하는 시퀀스이며,
 * ItemRepository.findMaxItemNoByCno()로 최댓값을 조회해 +1한 값으로 채번한다.
 *
 * 이미지(pic1~3)는 BLOB으로 DB에 저장되며, JSON 직렬화에서는 제외된다.
 * 대신 @PostLoad 콜백에서 picNUrl(Transient 필드)에 URL 문자열을 세팅해 프론트로 전달한다.
 */
@Entity
@Table(name = "ITEM")
@IdClass(ItemId.class)
@Getter
@Setter
public class Item {

    // ── 복합 PK ─────────────────────────────────────────────────
    /** 판매자 회원번호 (복합 PK의 첫 번째 키, CUSTOMER.CNO 참조) */
    @Id
    @Column(name = "CNO", length = 10)
    private String cno;

    /** 판매자별 상품 번호 (복합 PK의 두 번째 키, 1씩 증가) */
    @Id
    @Column(name = "ITEMNO")
    private Long itemNo;

    // ── 기본 정보 ────────────────────────────────────────────────
    @Column(name = "TITLE", nullable = false, length = 100)
    private String title;

    @Column(name = "DESCRIPTION", length = 300)
    private String description;

    @Column(name = "CATEGORY", nullable = false, length = 50)
    private String category;

    /** 판매자가 제시한 희망 가격 (원) */
    @Column(name = "PRICE", nullable = false)
    private Long price;

    /** 거래 희망 장소 (자유 텍스트, 예: "인천 연수구 송도동") */
    @Column(name = "TRADEPLACE", length = 200)
    private String tradePlace;

    // ── 일자 ─────────────────────────────────────────────────────
    /** 상품 등록 일시 */
    @Column(name = "REGDATETIME", nullable = false)
    private LocalDateTime regDateTime;

    /**
     * 예약·거래 완료 처리 일시.
     * - 구매 요청 승인 시: 예약 일시로 기록
     * - 거래 완료 처리 시: 완료 일시로 갱신
     * - 스케줄러가 48시간 초과 여부 판단에 사용 (ItemCleanupScheduler 참고)
     */
    @Column(name = "RESDATETIME")
    private LocalDateTime resDateTime;

    // ── 판매 상태 ────────────────────────────────────────────────
    /**
     * 판매 상태 (도메인 값 목록):
     * "판매 중" → "예약 중" → "거래 완료"
     * 관리자가 "검토 중"으로 강제 변경 가능
     */
    @Column(name = "SELLSTATUS", length = 20)
    private String sellStatus;

    /** 최종 거래 금액 — 거래 완료 시에만 기록됨 */
    @Column(name = "FINALPRICE")
    private Long finalPrice;

    // ── 이미지 (BLOB, JSON 직렬화 제외) ─────────────────────────
    /** 대표 이미지 바이너리. JSON으로 전송하지 않고 pic1Url로 대체한다. */
    @JsonIgnore
    @Lob
    @Column(name = "PIC1")
    private byte[] pic1;

    @JsonIgnore
    @Lob
    @Column(name = "PIC2")
    private byte[] pic2;

    @JsonIgnore
    @Lob
    @Column(name = "PIC3")
    private byte[] pic3;

    // ── 이미지 URL (DB 미저장, JSON 전송용) ──────────────────────
    /**
     * 이미지 접근 URL — DB에 저장되지 않는 계산 필드.
     * @PostLoad 에서 BLOB 존재 여부를 확인한 뒤 URL을 동적으로 세팅한다.
     */
    @Transient
    private String pic1Url;

    @Transient
    private String pic2Url;

    @Transient
    private String pic3Url;

    /**
     * 엔티티가 DB에서 로드된 직후 자동 호출.
     * BLOB이 비어 있지 않으면 REST API 경로를 이미지 URL로 설정한다.
     */
    @PostLoad
    private void populateImageUrls() {
        if (pic1 != null && pic1.length > 0)
            this.pic1Url = "/api/items/" + cno + "/" + itemNo + "/pic/1";
        if (pic2 != null && pic2.length > 0)
            this.pic2Url = "/api/items/" + cno + "/" + itemNo + "/pic/2";
        if (pic3 != null && pic3.length > 0)
            this.pic3Url = "/api/items/" + cno + "/" + itemNo + "/pic/3";
    }
}
