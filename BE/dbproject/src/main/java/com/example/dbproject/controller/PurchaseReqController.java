package com.example.dbproject.controller;

import com.example.dbproject.dto.CompletedSaleDto;
import com.example.dbproject.dto.PurchasedItemDto;
import com.example.dbproject.dto.ReceivedPurchaseReqDto;
import com.example.dbproject.entity.ChatMessage;
import com.example.dbproject.entity.ChatRoom;
import com.example.dbproject.entity.Item;
import com.example.dbproject.entity.ItemId;
import com.example.dbproject.entity.PurchaseReq;
import com.example.dbproject.entity.PurchaseReqId;
import com.example.dbproject.repository.ChatMessageRepository;
import com.example.dbproject.repository.ChatRoomRepository;
import com.example.dbproject.repository.ItemRepository;
import com.example.dbproject.repository.PurchaseReqRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 구매 요청(PurchaseReq) REST API 컨트롤러
 *
 * Base URL: /api/purchase
 * CORS: http://localhost:5173 (Vite 개발 서버)
 *
 * 구매 요청의 전체 생명주기를 관리한다.
 *
 * 제공 기능:
 *   POST   /                                  : 구매 요청 전송 (구매자 → 판매자)
 *   GET    /item/{cno}/{itemNo}               : 특정 상품에 들어온 요청 목록 (판매자용)
 *   GET    /sent/{requestCno}                 : 내가 보낸 구매 요청 목록 (구매자용)
 *   GET    /received/{cno}                    : 내 상품에 들어온 전체 요청 목록 (판매자용)
 *   GET    /pending/{requestCno}              : 아직 처리되지 않은 나의 요청 목록 (구매자용)
 *   PATCH  /{requestCno}/{cno}/{itemNo}/approve  : 승인 → 상태 '예약 중', 나머지 요청 자동 거절
 *   PATCH  /{requestCno}/{cno}/{itemNo}/complete : 거래 완료 → 상태 '거래 완료', finalPrice 기록
 *   PATCH  /{requestCno}/{cno}/{itemNo}/reject   : 명시적 거절 → REJECT_NOTICE 채팅 메시지 전송
 *   DELETE /{requestCno}/{cno}/{itemNo}          : 구매자가 직접 요청 취소
 *   GET    /sales/{cno}                      : 판매자의 거래 완료 내역
 *   GET    /history/{requestCno}             : 구매자의 구매 내역
 *
 * 복합 PK: PurchaseReqId(requestCno, cno, itemNo)
 *   - requestCno : 구매 요청자 cno
 *   - cno        : 판매자 cno (= 상품 owner)
 *   - itemNo     : 상품 번호
 */
@RestController
@RequestMapping("/api/purchase")
@CrossOrigin(origins = "http://localhost:5173")
public class PurchaseReqController {

    @Autowired private PurchaseReqRepository  purchaseReqRepository;
    @Autowired private ItemRepository         itemRepository;
    @Autowired private ChatRoomRepository     chatRoomRepository;
    @Autowired private ChatMessageRepository  chatMessageRepository;
    @Autowired private SimpMessagingTemplate  messagingTemplate;

    // ── 구매 요청 전송 ────────────────────────────────────────────
    // body: { requestCno, cno, itemNo, reqPrice, reqMessage }
    // 성공 시 판매자의 /topic/purchase/{cno} 로 실시간 알림을 전송한다.
    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody PurchaseReq req) {
        // 자기 자신 상품에 요청 불가
        if (req.getRequestCno().equals(req.getCno())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("본인 상품에는 구매 요청을 할 수 없습니다.");
        }
        // 중복 요청 방지 (복합 PK 기준)
        PurchaseReqId id = new PurchaseReqId(req.getRequestCno(), req.getCno(), req.getItemNo());
        if (purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 구매 요청을 보냈습니다.");
        }
        // 상품 존재 여부 + 판매 중 상태 확인
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        if (!"판매 중".equals(itemOpt.get().getSellStatus())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("판매 중인 상품에만 구매 요청할 수 있습니다.");
        }

        req.setReqDateTime(LocalDateTime.now());
        PurchaseReq saved = purchaseReqRepository.save(req);

        // 판매자에게 WebSocket 실시간 알림 (ReceivedPurchaseReqDto 포함)
        ReceivedPurchaseReqDto dto = new ReceivedPurchaseReqDto(
                saved.getRequestCno(), saved.getCno(), saved.getItemNo(),
                itemOpt.get().getTitle(), saved.getReqPrice(),
                saved.getReqMessage(), saved.getReqDateTime()
        );
        messagingTemplate.convertAndSend("/topic/purchase/" + req.getCno(), dto);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // ── 특정 상품에 들어온 구매 요청 목록 (판매자용) ─────────────
    @GetMapping("/item/{cno}/{itemNo}")
    public ResponseEntity<List<PurchaseReq>> getRequestsForItem(
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {
        return ResponseEntity.ok(purchaseReqRepository.findByCnoAndItemNo(cno, itemNo));
    }

    // ── 내가 보낸 구매 요청 전체 목록 (구매자용) ─────────────────
    @GetMapping("/sent/{requestCno}")
    public ResponseEntity<List<PurchaseReq>> getSentRequests(
            @PathVariable("requestCno") String requestCno) {
        return ResponseEntity.ok(purchaseReqRepository.findByRequestCno(requestCno));
    }

    // ── 내 상품 전체에 들어온 구매 요청 목록 (판매자용) ──────────
    // '판매 중' 상태인 상품에 대한 요청만 반환한다.
    @GetMapping("/received/{cno}")
    public ResponseEntity<List<ReceivedPurchaseReqDto>> getReceivedRequests(
            @PathVariable("cno") String cno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByCno(cno);
        List<ReceivedPurchaseReqDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "판매 중".equals(item.getSellStatus()))
                        .map(item -> new ReceivedPurchaseReqDto(
                                req.getRequestCno(), req.getCno(), req.getItemNo(),
                                item.getTitle(), req.getReqPrice(),
                                req.getReqMessage(), req.getReqDateTime()
                        ))
                        .orElse(null))
                .filter(dto -> dto != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── 내가 보낸 요청 중 아직 승인 대기 중인 것 (구매자용) ──────
    // 상품이 여전히 '판매 중'인 요청만 필터링한다.
    @GetMapping("/pending/{requestCno}")
    public ResponseEntity<List<ReceivedPurchaseReqDto>> getPendingRequests(
            @PathVariable("requestCno") String requestCno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByRequestCno(requestCno);
        List<ReceivedPurchaseReqDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "판매 중".equals(item.getSellStatus()))
                        .map(item -> new ReceivedPurchaseReqDto(
                                req.getRequestCno(), req.getCno(), req.getItemNo(),
                                item.getTitle(), req.getReqPrice(),
                                req.getReqMessage(), req.getReqDateTime()
                        ))
                        .orElse(null))
                .filter(dto -> dto != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── 구매 요청 승인 ────────────────────────────────────────────
    // 처리 순서:
    //  1. 상품 상태를 '예약 중'으로 변경, resDateTime 기록
    //  2. 승인받지 못한 다른 요청자들에게 REJECT_NOTICE 채팅 메시지 전송 (WebSocket)
    //  3. 다른 구매 요청 DB에서 삭제
    //  4. 승인된 구매자 채팅방에 수락 텍스트 메시지 전송 (WebSocket)
    //  5. 판매자/구매자 UI 실시간 갱신 신호 전송
    @Transactional
    @PatchMapping("/{requestCno}/{cno}/{itemNo}/approve")
    public ResponseEntity<?> approveRequest(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {

        if (!purchaseReqRepository.existsById(new PurchaseReqId(requestCno, cno, itemNo))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(cno, itemNo));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }

        Item item = itemOpt.get();
        item.setSellStatus("예약 중");
        item.setResDateTime(LocalDateTime.now());
        itemRepository.save(item);

        // 거절 대상: 승인된 requestCno를 제외한 나머지 요청자들
        List<PurchaseReq> otherReqs = purchaseReqRepository.findByCnoAndItemNo(cno, itemNo)
                .stream()
                .filter(r -> !r.getRequestCno().equals(requestCno))
                .collect(Collectors.toList());

        String pic1Url = (item.getPic1() != null && item.getPic1().length > 0)
                ? "/api/items/" + cno + "/" + itemNo + "/pic/1"
                : null;

        for (PurchaseReq other : otherReqs) {
            // (판매자, 거절 구매자, 상품) 기준 채팅방 조회 또는 신규 생성
            ChatRoom room = chatRoomRepository
                    .findByCnoAndReceiveCnoAndItemNo(cno, other.getRequestCno(), itemNo)
                    .orElseGet(() -> {
                        ChatRoom r = new ChatRoom();
                        r.setCno(cno);
                        r.setReceiveCno(other.getRequestCno());
                        r.setItemNo(itemNo);
                        r.setCreateDatetime(LocalDateTime.now());
                        return chatRoomRepository.save(r);
                    });

            // REJECT_NOTICE JSON 메시지 생성 (프론트엔드에서 특수 렌더링)
            String rejectContent = "{\"type\":\"REJECT_NOTICE\",\"itemTitle\":\""
                    + item.getTitle().replace("\\", "\\\\").replace("\"", "\\\"")
                    + "\",\"cno\":\"" + cno
                    + "\",\"itemNo\":" + itemNo
                    + ",\"pic1Url\":" + (pic1Url != null ? "\"" + pic1Url + "\"" : "null")
                    + "}";

            ChatMessage msg = new ChatMessage();
            msg.setRoomNo(room.getRoomNo());
            msg.setSender("S");
            msg.setContent(rejectContent);
            msg.setSentDatetime(LocalDateTime.now());
            msg.setIsRead("N");
            ChatMessage saved = chatMessageRepository.save(msg);
            messagingTemplate.convertAndSend("/topic/chat/" + room.getRoomNo(), saved);
        }

        // 승인된 요청 외 나머지 구매 요청 DB에서 삭제
        purchaseReqRepository.deleteByCnoAndItemNoAndRequestCnoNot(cno, itemNo, requestCno);

        // 판매자 UI에 해당 상품의 모든 요청 제거 신호 전송
        messagingTemplate.convertAndSend("/topic/purchase/" + cno + "/deleted",
                (Object) Map.of("itemNo", itemNo));

        // 수락된 구매자 pendingReqs 실시간 제거
        Map<String, Object> approvedBuyerPayload = new java.util.HashMap<>();
        approvedBuyerPayload.put("cno", cno);
        approvedBuyerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend(
                "/topic/purchase/pending/" + requestCno + "/deleted",
                (Object) approvedBuyerPayload);

        // 수락된 구매자 채팅방에 수락 텍스트 메시지 전송
        ChatRoom approvedRoom = chatRoomRepository
                .findByCnoAndReceiveCnoAndItemNo(cno, requestCno, itemNo)
                .orElseGet(() -> {
                    ChatRoom r = new ChatRoom();
                    r.setCno(cno);
                    r.setReceiveCno(requestCno);
                    r.setItemNo(itemNo);
                    r.setCreateDatetime(LocalDateTime.now());
                    return chatRoomRepository.save(r);
                });
        ChatMessage approvalMsg = new ChatMessage();
        approvalMsg.setRoomNo(approvedRoom.getRoomNo());
        approvalMsg.setSender("S");
        approvalMsg.setContent("판매자가 요청을 수락했어요.");
        approvalMsg.setSentDatetime(LocalDateTime.now());
        approvalMsg.setIsRead("N");
        messagingTemplate.convertAndSend(
                "/topic/chat/" + approvedRoom.getRoomNo(),
                chatMessageRepository.save(approvalMsg));

        return ResponseEntity.ok(item);
    }

    // ── 거래 완료 처리 ────────────────────────────────────────────
    // 상품 상태를 '거래 완료'로 변경하고 최종 거래 금액(finalPrice)을 기록한다.
    // body: { finalPrice: Long }
    @PatchMapping("/{requestCno}/{cno}/{itemNo}/complete")
    public ResponseEntity<?> completeTransaction(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Map<String, Long> body) {

        if (!purchaseReqRepository.existsById(new PurchaseReqId(requestCno, cno, itemNo))) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(cno, itemNo));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }

        Item item = itemOpt.get();
        item.setSellStatus("거래 완료");
        item.setFinalPrice(body.get("finalPrice"));
        item.setResDateTime(LocalDateTime.now());
        return ResponseEntity.ok(itemRepository.save(item));
    }

    // ── 판매자의 거래 완료 내역 조회 ─────────────────────────────
    // 거래 완료 상품과 구매자 cno를 포함하는 CompletedSaleDto 목록을 반환한다.
    @GetMapping("/sales/{cno}")
    public ResponseEntity<List<CompletedSaleDto>> getCompletedSales(
            @PathVariable("cno") String cno) {
        List<Item> completedItems = itemRepository.findByCnoAndSellStatus(cno, "거래 완료");
        List<CompletedSaleDto> result = completedItems.stream().map(item -> {
            List<PurchaseReq> reqs = purchaseReqRepository.findByCnoAndItemNo(cno, item.getItemNo());
            // 남아 있는 구매 요청의 첫 번째가 최종 구매자
            String buyerCno = reqs.isEmpty() ? null : reqs.get(0).getRequestCno();
            return new CompletedSaleDto(
                    item.getCno(), item.getItemNo(), item.getTitle(), item.getCategory(),
                    item.getPrice(), item.getFinalPrice(), item.getResDateTime(), buyerCno
            );
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── 구매자의 구매 내역 조회 ───────────────────────────────────
    // 거래 완료 상태인 상품만 필터링하여 반환한다.
    @GetMapping("/history/{requestCno}")
    public ResponseEntity<List<PurchasedItemDto>> getPurchaseHistory(
            @PathVariable("requestCno") String requestCno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByRequestCno(requestCno);
        List<PurchasedItemDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "거래 완료".equals(item.getSellStatus()))
                        .map(item -> new PurchasedItemDto(
                                item.getCno(), item.getItemNo(), item.getTitle(), item.getCategory(),
                                item.getPrice(), item.getFinalPrice(), item.getSellStatus(),
                                item.getResDateTime(), req.getReqDateTime(), req.getReqPrice()
                        ))
                        .orElse(null))
                .filter(d -> d != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── 판매자의 명시적 거절 ──────────────────────────────────────
    // approveRequest와 달리 단일 요청만 거절하며 상품 상태는 변경하지 않는다.
    // 처리 순서:
    //  1. REJECT_NOTICE 채팅 메시지 저장 및 WebSocket 전송
    //  2. 구매 요청 DB에서 삭제
    //  3. 판매자·구매자 UI에 삭제 신호 전송
    @Transactional
    @PatchMapping("/{requestCno}/{cno}/{itemNo}/reject")
    public ResponseEntity<?> rejectRequest(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {

        PurchaseReqId id = new PurchaseReqId(requestCno, cno, itemNo);
        if (!purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(cno, itemNo));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        Item item = itemOpt.get();

        // (판매자, 구매자, 상품) 기준 채팅방 조회 또는 신규 생성
        ChatRoom room = chatRoomRepository
                .findByCnoAndReceiveCnoAndItemNo(cno, requestCno, itemNo)
                .orElseGet(() -> {
                    ChatRoom r = new ChatRoom();
                    r.setCno(cno);
                    r.setReceiveCno(requestCno);
                    r.setItemNo(itemNo);
                    r.setCreateDatetime(LocalDateTime.now());
                    return chatRoomRepository.save(r);
                });

        // REJECT_NOTICE JSON 메시지 저장 및 WebSocket 전송
        String pic1Url = (item.getPic1() != null && item.getPic1().length > 0)
                ? "/api/items/" + cno + "/" + itemNo + "/pic/1"
                : null;
        String rejectContent = "{\"type\":\"REJECT_NOTICE\",\"itemTitle\":\""
                + item.getTitle().replace("\\", "\\\\").replace("\"", "\\\"")
                + "\",\"cno\":\"" + cno
                + "\",\"itemNo\":" + itemNo
                + ",\"pic1Url\":" + (pic1Url != null ? "\"" + pic1Url + "\"" : "null")
                + "}";
        ChatMessage msg = new ChatMessage();
        msg.setRoomNo(room.getRoomNo());
        msg.setSender("S");
        msg.setContent(rejectContent);
        msg.setSentDatetime(LocalDateTime.now());
        msg.setIsRead("N");
        ChatMessage savedMsg = chatMessageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/chat/" + room.getRoomNo(), savedMsg);

        // 구매 요청 삭제
        purchaseReqRepository.deleteById(id);

        // 판매자 receivedReqs UI 갱신
        Map<String, Object> sellerPayload = new java.util.HashMap<>();
        sellerPayload.put("requestCno", requestCno);
        sellerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend(
                "/topic/purchase/" + cno + "/deleted", (Object) sellerPayload);

        // 구매자 pendingReqs UI 갱신
        Map<String, Object> buyerPayload = new java.util.HashMap<>();
        buyerPayload.put("cno", cno);
        buyerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend(
                "/topic/purchase/pending/" + requestCno + "/deleted", (Object) buyerPayload);

        return ResponseEntity.noContent().build();
    }

    // ── 구매자의 요청 직접 취소 ───────────────────────────────────
    // REJECT_NOTICE 없이 구매 요청만 삭제하고 판매자 UI에 갱신 신호를 보낸다.
    @DeleteMapping("/{requestCno}/{cno}/{itemNo}")
    public ResponseEntity<?> deleteRequest(
            @PathVariable("requestCno") String requestCno,
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {

        PurchaseReqId id = new PurchaseReqId(requestCno, cno, itemNo);
        if (!purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("구매 요청을 찾을 수 없습니다.");
        }
        purchaseReqRepository.deleteById(id);

        // 판매자 UI에서 해당 요청 제거
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("requestCno", requestCno);
        payload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend(
                "/topic/purchase/" + cno + "/deleted", (Object) payload);

        return ResponseEntity.noContent().build();
    }
}
