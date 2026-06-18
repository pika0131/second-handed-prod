package com.example.dbproject.scheduler;

import com.example.dbproject.entity.Item;
import com.example.dbproject.repository.ItemRepository;
import com.example.dbproject.repository.PurchaseReqRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 예약 만료 상품 자동 복귀 스케줄러
 *
 * "예약 중" 상태로 48시간이 지난 상품을 자동으로 "판매 중"으로 되돌린다.
 * 판매자가 거래를 완료하지 않거나 연락이 끊긴 경우를 처리하기 위한 안전장치다.
 *
 * 처리 흐름:
 *   1. resDateTime이 48시간 이전인 "예약 중" 상품 조회
 *   2. sellStatus를 "판매 중"으로 변경, resDateTime을 null로 초기화
 *   3. 해당 상품의 잔여 구매 요청 일괄 삭제
 *
 * 실행 주기: 1분마다 (fixedDelay = 60,000ms)
 */
@Component
public class ItemCleanupScheduler {

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private PurchaseReqRepository purchaseReqRepository;

    /**
     * 예약 만료 상품 복귀 처리.
     * fixedDelay 방식이므로 이전 실행이 끝난 후 60초 뒤에 다음 실행이 시작된다.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void revertExpiredReservations() {
        // 48시간 전 시각 계산 — 이보다 이전에 예약된 상품이 만료 대상
        LocalDateTime cutoff = LocalDateTime.now().minusHours(48);

        List<Item> expiredItems = itemRepository
                .findBySellStatusAndResDateTimeBefore("예약 중", cutoff);

        for (Item item : expiredItems) {
            // 판매 상태 초기화
            item.setSellStatus("판매 중");
            item.setResDateTime(null);
            itemRepository.save(item);

            // 잔여 구매 요청 삭제 (새로 요청이 들어올 수 있도록)
            purchaseReqRepository.deleteByCnoAndItemNo(item.getCno(), item.getItemNo());
        }
    }
}
