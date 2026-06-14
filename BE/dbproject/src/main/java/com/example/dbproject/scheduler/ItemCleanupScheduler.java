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

@Component
public class ItemCleanupScheduler {

    @Autowired private ItemRepository itemRepository;
    @Autowired private PurchaseReqRepository purchaseReqRepository;

    // 1분마다 실행 — '예약 중' 상태가 48시간 초과 시 자동으로 '판매 중'으로 복귀
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void revertExpiredReservations() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(48);
        List<Item> expired = itemRepository.findBySellStatusAndResDateTimeBefore("예약 중", cutoff);

        for (Item item : expired) {
            item.setSellStatus("판매 중");
            item.setResDateTime(null);
            itemRepository.save(item);
            purchaseReqRepository.deleteByCnoAndItemNo(item.getCno(), item.getItemNo());
        }
    }
}
