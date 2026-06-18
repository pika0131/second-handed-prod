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

/**
 * 관리자(Admin) REST API 컨트롤러
 *
 * Base URL: /api/admin
 * CORS: http://localhost:5173
 *
 * 관리자 전용 기능을 제공한다. 인증/인가 로직은 프론트엔드(AuthContext.isAdmin)에서만
 * 처리하므로, 백엔드에서는 cno == "c0" 여부를 별도 검증하지 않는다.
 *
 * 제공 기능:
 *   POST  /items/{cno}/{itemNo}/delete     : 상품 강제 삭제 + 판매자 알림 전송
 *   PATCH /items/{cno}/{itemNo}/review     : 상품을 '검토 중' 상태로 변경 + 판매자 알림
 *   GET   /messages/{sellerCno}            : 판매자의 관리자 알림 목록 조회
 *   GET   /messages/{sellerCno}/unread-count : 안읽은 알림 수 조회
 *   PATCH /messages/{msgId}/read           : 알림 읽음 처리
 */
@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class AdminController {

    private final AdminMsgRepository     adminMsgRepository;
    private final ItemRepository         itemRepository;
    private final PurchaseReqRepository  purchaseReqRepository;
    private final ChatMessageRepository  chatMessageRepository;
    private final ChatRoomRepository     chatRoomRepository;

    // ── 상품 강제 삭제 ────────────────────────────────────────────
    // body: { reason: "삭제 이유" }
    // 삭제 전 판매자에게 AdminMsg 알림을 남기고,
    // FK 순서(메시지 → 채팅방 → 구매요청 → 상품)로 연관 데이터를 삭제한다.
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

            // 판매자 알림 저장 (상품 삭제 전에 저장해야 itemTitle 참조 가능)
            AdminMsg msg = new AdminMsg();
            msg.setSellerCno(cno);
            msg.setItemTitle(item.getTitle());
            msg.setReason(reason);
            msg.setSentAt(LocalDateTime.now());
            msg.setIsRead("N");
            adminMsgRepository.save(msg);

            // 연관 데이터 삭제 (FK 제약 위반 방지)
            chatRoomRepository.findByCnoAndItemNo(cno, itemNo)
                    .forEach(room -> chatMessageRepository.deleteByRoomNo(room.getRoomNo()));
            chatRoomRepository.deleteByCnoAndItemNo(cno, itemNo);
            purchaseReqRepository.deleteByCnoAndItemNo(cno, itemNo);
            itemRepository.deleteById(id);

            return ResponseEntity.noContent().build();
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다."));
    }

    // ── 판매자 알림 목록 조회 ─────────────────────────────────────
    // 최신순 정렬 (sentAt DESC)
    @GetMapping("/messages/{sellerCno}")
    public ResponseEntity<List<AdminMsg>> getMessages(
            @PathVariable("sellerCno") String sellerCno) {
        return ResponseEntity.ok(
                adminMsgRepository.findBySellerCnoOrderBySentAtDesc(sellerCno));
    }

    // ── 안읽은 알림 수 조회 ───────────────────────────────────────
    // Layout 헤더 보라색 배지(purpleBadge) 카운트에 사용
    @GetMapping("/messages/{sellerCno}/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @PathVariable("sellerCno") String sellerCno) {
        long count = adminMsgRepository.countBySellerCnoAndIsRead(sellerCno, "N");
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ── 알림 읽음 처리 ────────────────────────────────────────────
    // 판매자가 '확인' 버튼을 누르면 isRead를 "Y"로 갱신한다.
    @PatchMapping("/messages/{msgId}/read")
    public ResponseEntity<Void> markRead(@PathVariable("msgId") Long msgId) {
        adminMsgRepository.findById(msgId).ifPresent(msg -> {
            msg.setIsRead("Y");
            adminMsgRepository.save(msg);
        });
        return ResponseEntity.ok().build();
    }

    // ── 상품 상태를 '검토 중'으로 변경 ───────────────────────────
    // body: { reason: "검토 사유" }
    // 판매자에게 "[검토 중] " 접두사가 붙은 알림을 전송한다.
    @Transactional
    @PatchMapping("/items/{cno}/{itemNo}/review")
    public ResponseEntity<?> setReviewStatus(
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Map<String, String> body) {

        ItemId id = new ItemId(cno, itemNo);
        return itemRepository.findById(id).<ResponseEntity<?>>map(item -> {

            String reason = body.getOrDefault("reason", "").trim();
            if (reason.isEmpty()) {
                return ResponseEntity.badRequest().body("검토 사유를 입력해주세요.");
            }

            // "[검토 중] " 접두사로 일반 삭제 알림과 구분 (ChatListPage에서 유형별 렌더링)
            AdminMsg msg = new AdminMsg();
            msg.setSellerCno(cno);
            msg.setItemTitle(item.getTitle());
            msg.setReason("[검토 중] " + reason);
            msg.setSentAt(LocalDateTime.now());
            msg.setIsRead("N");
            adminMsgRepository.save(msg);

            item.setSellStatus("검토 중");
            itemRepository.save(item);

            return ResponseEntity.ok().build();
        }).orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다."));
    }
}
