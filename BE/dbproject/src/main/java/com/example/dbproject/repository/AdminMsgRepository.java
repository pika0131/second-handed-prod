package com.example.dbproject.repository;

import com.example.dbproject.entity.AdminMsg;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 관리자 알림 메시지(AdminMsg) 데이터 접근 레이어
 *
 * 판매자별 알림 목록 조회 및 안읽은 수 집계를 위한 파생 쿼리를 제공한다.
 */
@Repository
public interface AdminMsgRepository extends JpaRepository<AdminMsg, Long> {

    /**
     * 특정 판매자에게 전달된 알림 목록을 최신순(sentAt DESC)으로 조회.
     * ChatListPage에서 관리자 알림 섹션을 렌더링할 때 사용한다.
     */
    List<AdminMsg> findBySellerCnoOrderBySentAtDesc(String sellerCno);

    /**
     * 특정 판매자의 안읽은(isRead = "N") 알림 수 집계.
     * Layout 헤더의 보라색 배지 카운트에 사용한다.
     */
    long countBySellerCnoAndIsRead(String sellerCno, String isRead);
}
