package com.example.dbproject.dto;

import java.time.LocalDateTime;

/**
 * 거래 완료 판매 내역 DTO
 *
 * 판매자가 '거래 기록 → 판매 내역' 화면에서 볼 수 있는 완료된 거래 정보를 담는다.
 * Item 엔티티에 구매자(buyerCno)가 직접 포함되지 않으므로,
 * PurchaseReqRepository에서 구매자를 별도로 조회해 함께 반환하기 위해 사용한다.
 *
 * @param cno          판매자 회원번호
 * @param itemNo       상품 번호
 * @param title        상품 제목
 * @param category     카테고리
 * @param price        등록 시 희망 가격 (원)
 * @param finalPrice   실제 거래 완료 금액 (원, null이면 희망가로 완료)
 * @param resDateTime  거래 완료 일시
 * @param buyerCno     구매자 회원번호 (구매 요청이 없으면 null)
 */
public record CompletedSaleDto(
        String cno,
        Long itemNo,
        String title,
        String category,
        Long price,
        Long finalPrice,
        LocalDateTime resDateTime,
        String buyerCno
) {}
