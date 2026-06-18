package com.example.dbproject.dto;

import java.time.LocalDateTime;

/**
 * 판매자가 수신한 구매 요청 DTO
 *
 * PurchaseReq 엔티티만으로는 상품 제목(itemTitle)을 알 수 없으므로,
 * Item 엔티티에서 제목을 조회해 합친 결과를 반환하기 위해 사용한다.
 *
 * WebSocket을 통한 실시간 구매 요청 알림(PurchaseReqController.createRequest)에서도
 * 동일한 DTO 형태로 판매자에게 전송된다.
 *
 * @param requestCno  구매 요청을 보낸 회원번호 (구매자)
 * @param cno         상품 판매자 회원번호
 * @param itemNo      상품 번호
 * @param itemTitle   상품 제목 (Item.title에서 조회)
 * @param reqPrice    구매자 희망 가격 (원)
 * @param reqMessage  구매자 메시지 (선택 항목, null 가능)
 * @param reqDateTime 요청 전송 일시
 */
public record ReceivedPurchaseReqDto(
        String requestCno,
        String cno,
        Long itemNo,
        String itemTitle,
        Long reqPrice,
        String reqMessage,
        LocalDateTime reqDateTime
) {}
