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

@RestController
@RequestMapping("/api/purchase")
@CrossOrigin(origins = "http://localhost:5173")
public class PurchaseReqController {

    @Autowired
    private PurchaseReqRepository purchaseReqRepository;

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // 구매 요청 전송
    // body: { requestCno, cno, itemNo, reqPrice, reqMessage }
    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody PurchaseReq req) {
        if (req.getRequestCno().equals(req.getCno())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("본인 상품에는 구매 요청을 할 수 없습니다.");
        }
        PurchaseReqId id = new PurchaseReqId(req.getRequestCno(), req.getCno(), req.getItemNo());
        if (purchaseReqRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 구매 요청을 보냈습니다.");
        }
        Optional<Item> itemOpt = itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()));
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        if (!"판매 중".equals(itemOpt.get().getSellStatus())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("판매 중인 상품에만 구매 요청할 수 있습니다.");
        }
        req.setReqDateTime(LocalDateTime.now());
        PurchaseReq saved = purchaseReqRepository.save(req);

        // 판매자에게 실시간 알림
        ReceivedPurchaseReqDto dto = new ReceivedPurchaseReqDto(
                saved.getRequestCno(), saved.getCno(), saved.getItemNo(),
                itemOpt.get().getTitle(), saved.getReqPrice(), saved.getReqMessage(), saved.getReqDateTime()
        );
        messagingTemplate.convertAndSend("/topic/purchase/" + req.getCno(), dto);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // 특정 상품에 들어온 구매 요청 목록 (판매자용)
    @GetMapping("/item/{cno}/{itemNo}")
    public ResponseEntity<List<PurchaseReq>> getRequestsForItem(
            @PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo) {
        return ResponseEntity.ok(purchaseReqRepository.findByCnoAndItemNo(cno, itemNo));
    }

    // 내가 보낸 구매 요청 목록 (구매자용)
    @GetMapping("/sent/{requestCno}")
    public ResponseEntity<List<PurchaseReq>> getSentRequests(@PathVariable("requestCno") String requestCno) {
        return ResponseEntity.ok(purchaseReqRepository.findByRequestCno(requestCno));
    }

    // 내 상품 전체에 들어온 구매 요청 목록 (판매자용, 판매 중인 상품만)
    @GetMapping("/received/{cno}")
    public ResponseEntity<List<ReceivedPurchaseReqDto>> getReceivedRequests(@PathVariable("cno") String cno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByCno(cno);
        List<ReceivedPurchaseReqDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "판매 중".equals(item.getSellStatus()))
                        .map(item -> new ReceivedPurchaseReqDto(
                                req.getRequestCno(), req.getCno(), req.getItemNo(),
                                item.getTitle(), req.getReqPrice(), req.getReqMessage(), req.getReqDateTime()
                        ))
                        .orElse(null))
                .filter(dto -> dto != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // 내가 보낸 구매 요청 중 아직 승인 대기 중인 것 (구매자용 — 상품이 '판매 중'인 것만)
    @GetMapping("/pending/{requestCno}")
    public ResponseEntity<List<ReceivedPurchaseReqDto>> getPendingRequests(@PathVariable("requestCno") String requestCno) {
        List<PurchaseReq> reqs = purchaseReqRepository.findByRequestCno(requestCno);
        List<ReceivedPurchaseReqDto> result = reqs.stream()
                .map(req -> itemRepository.findById(new ItemId(req.getCno(), req.getItemNo()))
                        .filter(item -> "판매 중".equals(item.getSellStatus()))
                        .map(item -> new ReceivedPurchaseReqDto(
                                req.getRequestCno(), req.getCno(), req.getItemNo(),
                                item.getTitle(), req.getReqPrice(), req.getReqMessage(), req.getReqDateTime()
                        ))
                        .orElse(null))
                .filter(dto -> dto != null)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // 구매 요청 승인 → 상품 sellStatus = '예약 중', resDateTime 기록, 나머지 요청 자동 삭제
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

        // 거절되는 구매자들에게 채팅방 메시지 전송
        List<PurchaseReq> otherReqs = purchaseReqRepository.findByCnoAndItemNo(cno, itemNo)
                .stream()
                .filter(r -> !r.getRequestCno().equals(requestCno))
                .collect(Collectors.toList());

        for (PurchaseReq other : otherReqs) {
            // 채팅방 양방향 조회 → 없으면 새 생성
            List<ChatRoom> existing = chatRoomRepository.findByPair(cno, other.getRequestCno());
            ChatRoom room;
            if (!existing.isEmpty()) {
                room = existing.get(0);
                room.setCno(cno);
                room.setReceiveCno(other.getRequestCno());
                room.setItemNo(itemNo);
                room = chatRoomRepository.save(room);
            } else {
                room = new ChatRoom();
                room.setCno(cno);
                room.setReceiveCno(other.getRequestCno());
                room.setItemNo(itemNo);
                room.setCreateDatetime(LocalDateTime.now());
                room = chatRoomRepository.save(room);
            }

            // 거절 메시지 저장 (상품명·사진 포함 JSON)
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
            ChatMessage saved = chatMessageRepository.save(msg);

            // WebSocket으로 실시간 전송
            messagingTemplate.convertAndSend("/topic/chat/" + room.getRoomNo(), saved);
        }

        // 승인된 요청(requestCno) 외 나머지 구매 요청 자동 삭제
        purchaseReqRepository.deleteByCnoAndItemNoAndRequestCnoNot(cno, itemNo, requestCno);

        // 판매자 UI에 해당 상품의 모든 요청 제거 신호 전송
        messagingTemplate.convertAndSend("/topic/purchase/" + cno + "/deleted",
                (Object) Map.of("itemNo", itemNo));

        // 수락된 구매자 pendingReqs 실시간 제거
        Map<String, Object> approvedBuyerPayload = new java.util.HashMap<>();
        approvedBuyerPayload.put("cno", cno);
        approvedBuyerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend("/topic/purchase/pending/" + requestCno + "/deleted",
                (Object) approvedBuyerPayload);

        // 수락된 구매자의 채팅방에 수락 메시지 전송
        List<ChatRoom> approvedRooms = chatRoomRepository.findByPair(cno, requestCno);
        ChatRoom approvedRoom;
        if (!approvedRooms.isEmpty()) {
            approvedRoom = approvedRooms.get(0);
            approvedRoom.setCno(cno);
            approvedRoom.setReceiveCno(requestCno);
            approvedRoom.setItemNo(itemNo);
            approvedRoom = chatRoomRepository.save(approvedRoom);
        } else {
            approvedRoom = new ChatRoom();
            approvedRoom.setCno(cno);
            approvedRoom.setReceiveCno(requestCno);
            approvedRoom.setItemNo(itemNo);
            approvedRoom.setCreateDatetime(LocalDateTime.now());
            approvedRoom = chatRoomRepository.save(approvedRoom);
        }
        ChatMessage approvalMsg = new ChatMessage();
        approvalMsg.setRoomNo(approvedRoom.getRoomNo());
        approvalMsg.setSender("S");
        approvalMsg.setContent("판매자가 요청을 수락했어요.");
        approvalMsg.setSentDatetime(LocalDateTime.now());
        approvalMsg.setIsRead("N");
        messagingTemplate.convertAndSend("/topic/chat/" + approvedRoom.getRoomNo(),
                chatMessageRepository.save(approvalMsg));

        return ResponseEntity.ok(item);
    }

    // 거래 완료 → 상품 sellStatus = '거래 완료', finalPrice 기록
    // body: { finalPrice }
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

    // 거래 완료된 판매 내역 (판매자용) - item + 구매자 cno 포함
    @GetMapping("/sales/{cno}")
    public ResponseEntity<List<CompletedSaleDto>> getCompletedSales(@PathVariable("cno") String cno) {
        List<Item> completedItems = itemRepository.findByCnoAndSellStatus(cno, "거래 완료");
        List<CompletedSaleDto> result = completedItems.stream().map(item -> {
            List<PurchaseReq> reqs = purchaseReqRepository.findByCnoAndItemNo(cno, item.getItemNo());
            String buyerCno = reqs.isEmpty() ? null : reqs.get(0).getRequestCno();
            return new CompletedSaleDto(
                    item.getCno(), item.getItemNo(), item.getTitle(), item.getCategory(),
                    item.getPrice(), item.getFinalPrice(), item.getResDateTime(), buyerCno
            );
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // 내가 구매한 내역 (구매자용) - 거래 완료된 것만
    @GetMapping("/history/{requestCno}")
    public ResponseEntity<List<PurchasedItemDto>> getPurchaseHistory(@PathVariable("requestCno") String requestCno) {
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

    // 판매자가 명시적으로 거절 → 채팅 메시지 전송 + 구매자 실시간 알림
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

        // 채팅방 양방향 조회 → 없으면 새 생성
        List<ChatRoom> existingRooms = chatRoomRepository.findByPair(cno, requestCno);
        ChatRoom room;
        if (!existingRooms.isEmpty()) {
            room = existingRooms.get(0);
            room.setCno(cno);
            room.setReceiveCno(requestCno);
            room.setItemNo(itemNo);
            room = chatRoomRepository.save(room);
        } else {
            room = new ChatRoom();
            room.setCno(cno);
            room.setReceiveCno(requestCno);
            room.setItemNo(itemNo);
            room.setCreateDatetime(LocalDateTime.now());
            room = chatRoomRepository.save(room);
        }

        // REJECT_NOTICE 메시지 저장 및 WebSocket 전송
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

        // 판매자 receivedReqs 업데이트
        Map<String, Object> sellerPayload = new java.util.HashMap<>();
        sellerPayload.put("requestCno", requestCno);
        sellerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend("/topic/purchase/" + cno + "/deleted", (Object) sellerPayload);

        // 구매자 pendingReqs 업데이트
        Map<String, Object> buyerPayload = new java.util.HashMap<>();
        buyerPayload.put("cno", cno);
        buyerPayload.put("itemNo", itemNo);
        messagingTemplate.convertAndSend("/topic/purchase/pending/" + requestCno + "/deleted", (Object) buyerPayload);

        return ResponseEntity.noContent().build();
    }

    // 구매자가 자신의 요청을 취소 (메시지 없이 단순 삭제)
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
        messagingTemplate.convertAndSend("/topic/purchase/" + cno + "/deleted", (Object) payload);
        return ResponseEntity.noContent().build();
    }
}
