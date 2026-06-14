package com.example.dbproject.repository;

import com.example.dbproject.entity.Item;
import com.example.dbproject.entity.ItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 기존 ItemRepository.java를 이 내용으로 교체하세요.
 * (메서드 2개 추가됨: 판매자별 조회 / 마지막 상품번호 조회)
 */
@Repository
public interface ItemRepository extends JpaRepository<Item, ItemId> {

    // 특정 판매자의 상품 전체
    List<Item> findByCno(String cno);

    // 해당 판매자가 가진 상품번호 중 가장 큰 값 (없으면 null) → 등록 시 채번에 사용
    @Query("SELECT MAX(i.itemNo) FROM Item i WHERE i.cno = :cno")
    Long findMaxItemNoByCno(@Param("cno") String cno);

    List<Item> findByCnoAndSellStatus(String cno, String sellStatus);

    List<Item> findBySellStatusAndResDateTimeBefore(String sellStatus, java.time.LocalDateTime cutoff);
}
