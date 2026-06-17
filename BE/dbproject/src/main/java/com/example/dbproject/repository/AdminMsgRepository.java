package com.example.dbproject.repository;

import com.example.dbproject.entity.AdminMsg;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdminMsgRepository extends JpaRepository<AdminMsg, Long> {
    List<AdminMsg> findBySellerCnoOrderBySentAtDesc(String sellerCno);
    long countBySellerCnoAndIsRead(String sellerCno, String isRead);
}
