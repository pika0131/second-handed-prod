package com.example.dbproject.repository;

import com.example.dbproject.entity.PurchaseReq;
import com.example.dbproject.entity.PurchaseReqId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 구매 요청(PurchaseReq) 데이터 접근 레이어
 *
 * PurchaseReq는 (requestCno, cno, itemNo) 복합 PK를 가진다.
 * 조회·삭제 시 PurchaseReqId 객체를 사용한다.
 */
@Repository
public interface PurchaseReqRepository extends JpaRepository<PurchaseReq, PurchaseReqId> {

    /**
     * 특정 상품에 들어온 구매 요청 목록 조회 (판매자용).
     * 판매자가 '내 상품' 화면에서 요청 패널을 열 때 사용한다.
     */
    List<PurchaseReq> findByCnoAndItemNo(String cno, Long itemNo);

    /**
     * 특정 판매자의 전체 상품에 들어온 구매 요청 목록 조회.
     * ChatListPage에서 판매자 전체 요청 현황을 보여줄 때 사용한다.
     */
    List<PurchaseReq> findByCno(String cno);

    /**
     * 특정 구매자가 보낸 구매 요청 목록 조회.
     * '승인 대기 중' 섹션 표시 및 구매자의 거래 이력 조회에 사용한다.
     */
    List<PurchaseReq> findByRequestCno(String requestCno);

    /**
     * 특정 상품의 모든 구매 요청 삭제.
     * 상품 삭제 또는 "예약 중" 자동 만료 복귀 시 호출된다.
     */
    void deleteByCnoAndItemNo(String cno, Long itemNo);

    /**
     * 구매 요청 승인 시 승인된 요청(requestCno)을 제외한 나머지를 일괄 삭제.
     * 한 상품에 여러 구매 요청이 있을 때, 한 명만 승인하면 나머지는 자동 거절 처리된다.
     */
    void deleteByCnoAndItemNoAndRequestCnoNot(String cno, Long itemNo, String requestCno);
}
