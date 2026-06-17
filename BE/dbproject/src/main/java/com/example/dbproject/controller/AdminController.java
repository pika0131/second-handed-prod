package com.example.dbproject.controller;

import com.example.dbproject.entity.AdminMsg;
import com.example.dbproject.entity.ItemId;
import com.example.dbproject.repository.AdminMsgRepository;
import com.example.dbproject.repository.ChatMessageRepository;
import com.example.dbproject.repository.ChatRoomRepository;
import com.example.dbproject.repository.ItemRepository;
import com.example.dbproject.repository.PurchaseReqRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class AdminController {

    private final AdminMsgRepository adminMsgRepository;
    private final ItemRepository itemRepository;
    private final PurchaseReqRepository purchaseReqRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;

    // 관리자 상품 강제 삭제 + 판매자 알림
    // body: { reason: "삭제 이유" }
    @Transactional
    @PostMapping("/items/{cno}/{itemNo}/delete")
    public ResponseEntity<?> adminDeleteItem(
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Map<String, String> body) {

        ItemId id = new ItemId(cno, itemNo);
        return itemRepository.findById(id).<ResponseEntity<?>>map(item -> {
            String reason = body.getOrDefault("reason", "").trim();
            if (reason.isEmpty()) {
                return ResponseEntity.badRequest().body("삭제 이유를 입력해주세요.");
            }

            // 판매자 알림 저장
            AdminMsg msg = new AdminMsg();
            msg.setSellerCno(cno);
            msg.setItemTitle(item.getTitle());
            msg.setReason(reason);
            msg.setSentAt(LocalDateTime.now());
            msg.setIsRead("N");
            adminMsgRepository.save(msg);

            // 상품 연관 데이터 삭제 (FK 순서)
            chatRoomRepository.findByCnoAndItemNo(cno, itemNo)
                    .forEach(room -> chatMessageRepository.deleteByRoomNo(room.getRoomNo()));
            chatRoomRepository.deleteByCnoAndItemNo(cno, itemNo);
            purchaseReqRepository.deleteByCnoAndItemNo(cno, itemNo);
            itemRepository.deleteById(id);

            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다."));
    }

    // 판매자의 관리자 알림 목록 조회
    @GetMapping("/messages/{sellerCno}")
    public ResponseEntity<List<AdminMsg>> getMessages(@PathVariable("sellerCno") String sellerCno) {
        return ResponseEntity.ok(adminMsgRepository.findBySellerCnoOrderBySentAtDesc(sellerCno));
    }

    // 안읽은 관리자 알림 수
    @GetMapping("/messages/{sellerCno}/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable("sellerCno") String sellerCno) {
        long count = adminMsgRepository.countBySellerCnoAndIsRead(sellerCno, "N");
        return ResponseEntity.ok(Map.of("count", count));
    }

    // 알림 읽음 처리
    @PatchMapping("/messages/{msgId}/read")
    public ResponseEntity<Void> markRead(@PathVariable("msgId") Long msgId) {
        adminMsgRepository.findById(msgId).ifPresent(msg -> {
            msg.setIsRead("Y");
            adminMsgRepository.save(msg);
        });
        return ResponseEntity.ok().build();
    }
}
