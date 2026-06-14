package com.example.dbproject.repository;

import com.example.dbproject.entity.PurchaseReq;
import com.example.dbproject.entity.PurchaseReqId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseReqRepository extends JpaRepository<PurchaseReq, PurchaseReqId> {

    // 특정 상품에 들어온 구매 요청 목록 (판매자용)
    List<PurchaseReq> findByCnoAndItemNo(String cno, Long itemNo);

    // 내가 보낸 구매 요청 목록 (구매자용)
    List<PurchaseReq> findByRequestCno(String requestCno);

    void deleteByCnoAndItemNo(String cno, Long itemNo);

    // 승인된 요청(requestCno)을 제외한 나머지 요청 일괄 삭제
    void deleteByCnoAndItemNoAndRequestCnoNot(String cno, Long itemNo, String requestCno);
}
