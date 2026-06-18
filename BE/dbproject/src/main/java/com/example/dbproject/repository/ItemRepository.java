package com.example.dbproject.repository;

import com.example.dbproject.entity.Item;
import com.example.dbproject.entity.ItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 상품(Item) 데이터 접근 레이어
 *
 * Item은 (cno, itemNo)를 복합 PK로 사용하므로, 조회 시 반드시 ItemId 객체를 전달한다.
 * itemNo는 같은 판매자(cno) 내에서 1씩 증가하는 로컬 시퀀스이며,
 * findMaxItemNoByCno()로 현재 최댓값을 조회한 뒤 +1을 새 번호로 사용한다.
 */
@Repository
public interface ItemRepository extends JpaRepository<Item, ItemId> {

    /**
     * 특정 판매자의 전체 상품 목록 조회.
     * '내 판매 상품' 화면과 상품 수정 시 판매자 본인 상품만 표시할 때 사용한다.
     */
    List<Item> findByCno(String cno);

    /**
     * 특정 판매자의 상품번호 중 최댓값 조회.
     * 반환값이 null이면 해당 판매자의 첫 번째 상품이므로 0L로 처리한다.
     *
     * 사용 예시 (ItemController.createItem):
     *   Long maxNo = findMaxItemNoByCno(cno);
     *   item.setItemNo((maxNo == null ? 0L : maxNo) + 1);
     */
    @Query("SELECT MAX(i.itemNo) FROM Item i WHERE i.cno = :cno")
    Long findMaxItemNoByCno(@Param("cno") String cno);

    /**
     * 특정 판매자의 특정 판매 상태 상품 목록 조회.
     * 판매 내역 화면에서 "거래 완료" 상품만 가져올 때 사용한다.
     */
    List<Item> findByCnoAndSellStatus(String cno, String sellStatus);

    /**
     * 특정 판매 상태이면서 resDateTime이 cutoff 이전인 상품 목록 조회.
     * ItemCleanupScheduler가 48시간 이상 "예약 중"인 상품을 자동 복귀시킬 때 사용한다.
     */
    List<Item> findBySellStatusAndResDateTimeBefore(String sellStatus, java.time.LocalDateTime cutoff);
}
