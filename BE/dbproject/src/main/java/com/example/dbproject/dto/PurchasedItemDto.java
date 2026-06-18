package com.example.dbproject.dto;

import java.time.LocalDateTime;

/**
 * 구매자의 구매 완료 내역 DTO
 *
 * 구매자가 '거래 기록 → 구매 내역' 화면에서 볼 수 있는 항목을 담는다.
 * 구매 요청(PurchaseReq) 정보와 상품(Item) 정보를 합쳐서 반환하기 위해 사용한다.
 *
 * @param cno          판매자 회원번호 (상품 조회에 필요)
 * @param itemNo       상품 번호
 * @param title        상품 제목
 * @param category     카테고리
 * @param price        판매자의 등록 희망 가격 (원)
 * @param finalPrice   실제 거래 완료 금액 (원)
 * @param sellStatus   상품 판매 상태 ("거래 완료")
 * @param resDateTime  거래 완료 일시
 * @param reqDateTime  구매자가 요청을 보낸 일시
 * @param reqPrice     구매자가 제시한 희망 가격 (원)
 */
public record PurchasedItemDto(
        String cno,
        Long itemNo,
        String title,
        String category,
        Long price,
        Long finalPrice,
        String sellStatus,
        LocalDateTime resDateTime,
        LocalDateTime reqDateTime,
        Long reqPrice
) {}
