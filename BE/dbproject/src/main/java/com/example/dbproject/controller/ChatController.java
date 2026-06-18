package com.example.dbproject.controller;

import com.example.dbproject.entity.ChatMessage;
import com.example.dbproject.entity.ChatRoom;
import com.example.dbproject.repository.ChatMessageRepository;
import com.example.dbproject.repository.ChatRoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 채팅(Chat) REST + WebSocket 컨트롤러
 *
 * REST:
 *   POST  /api/chat/rooms               : 채팅방 생성 또는 기존 방 반환
 *   GET   /api/chat/rooms/user/{cno}    : 사용자의 채팅방 목록
 *   GET   /api/chat/rooms/{roomNo}/messages : 채팅방 메시지 내역
 *   PATCH /api/chat/rooms/{roomNo}/read : 읽음 처리
 *   GET   /api/chat/unread/{cno}        : 사용자별 안읽은 메시지 수 목록
 *
 * WebSocket (STOMP):
 *   구독: /topic/chat/{roomNo}
 *   발행: /app/chat/{roomNo}  → sendMessage()
 *
 * 채팅방 식별 기준: (판매자 cno, 구매자 receiveCno, 상품 itemNo) — DB UNIQUE 제약과 동일
 */
@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class ChatController {

    private final ChatRoomRepository     chatRoomRepository;
    private final ChatMessageRepository  chatMessageRepository;
    private final SimpMessagingTemplate  messagingTemplate;

    // ── 채팅방 생성 또는 기존 방 반환 ────────────────────────────
    // body: { cno(구매자), receiveCno(판매자), itemNo }
    // ⚠ DB 저장 시 역할이 반전됨: room.cno = 판매자, room.receiveCno = 구매자
    //   (FK_CHAT_ITEM 제약: CHATROOM.CNO → ITEM.CNO)
    @PostMapping("/api/chat/rooms")
    public ResponseEntity<?> getOrCreateRoom(@RequestBody Map<String, Object> body) {
        try {
            String buyerCno  = (String) body.get("cno");
            String sellerCno = (String) body.get("receiveCno");
            Long   itemNo    = Long.valueOf(body.get("itemNo").toString());

            if (buyerCno == null || sellerCno == null) {
                return ResponseEntity.badRequest().body("cno, receiveCno 필드가 필요합니다.");
            }

            // (판매자, 구매자, 상품) 조합으로 기존 채팅방 조회 — 있으면 그대로 반환
            Optional<ChatRoom> existing =
                    chatRoomRepository.findByCnoAndReceiveCnoAndItemNo(sellerCno, buyerCno, itemNo);
            if (existing.isPresent()) {
                return ResponseEntity.ok(existing.get());
            }

            // 없으면 새 채팅방 생성
            ChatRoom room = new ChatRoom();
            room.setCno(sellerCno);         // room.cno = 판매자
            room.setReceiveCno(buyerCno);   // room.receiveCno = 구매자
            room.setItemNo(itemNo);
            room.setCreateDatetime(LocalDateTime.now());
            return ResponseEntity.ok(chatRoomRepository.save(room));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("채팅방 생성 실패: " + e.getMessage());
        }
    }

    // ── 특정 사용자의 채팅방 목록 조회 ───────────────────────────
    // 판매자(cno) 또는 구매자(receiveCno)로 참여 중인 모든 채팅방을 반환
    @GetMapping("/api/chat/rooms/user/{cno}")
    public ResponseEntity<List<ChatRoom>> getRooms(@PathVariable("cno") String cno) {
        return ResponseEntity.ok(chatRoomRepository.findByCnoOrReceiveCno(cno, cno));
    }

    // ── 채팅방 메시지 내역 조회 ───────────────────────────────────
    // 시간순(오래된 것부터) 정렬
    @GetMapping("/api/chat/rooms/{roomNo}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(
            @PathVariable("roomNo") Long roomNo) {
        return ResponseEntity.ok(
                chatMessageRepository.findByRoomNoOrderBySentDatetimeAsc(roomNo));
    }

    // ── 읽음 처리 ─────────────────────────────────────────────────
    // body: { mySender: "B" or "S" }
    // 채팅방에 입장할 때 호출 — 상대방이 보낸 안읽은 메시지를 일괄 읽음 처리
    @PatchMapping("/api/chat/rooms/{roomNo}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable("roomNo") Long roomNo,
            @RequestBody Map<String, String> body) {
        chatMessageRepository.markAsRead(roomNo, body.get("mySender"));
        return ResponseEntity.ok().build();
    }

    // ── 사용자의 채팅방별 안읽은 메시지 수 목록 조회 ─────────────
    // 반환: [ { roomNo: Long, unreadCount: Long }, ... ]
    // Layout 헤더의 채팅 배지와 ChatListPage unreadMap 갱신에 사용
    @GetMapping("/api/chat/unread/{cno}")
    public ResponseEntity<List<Map<String, Object>>> getAllUnread(
            @PathVariable("cno") String cno) {
        List<ChatRoom> rooms = chatRoomRepository.findByCnoOrReceiveCno(cno, cno);

        List<Map<String, Object>> result = rooms.stream().map(room -> {
            // 내가 구매자(B)인지 판매자(S)인지 판단
            String mySender = room.getReceiveCno().equals(cno) ? "B" : "S";
            Long   count    = chatMessageRepository.countUnread(room.getRoomNo(), mySender);

            Map<String, Object> entry = new HashMap<>();
            entry.put("roomNo",      room.getRoomNo());
            entry.put("unreadCount", count);
            return entry;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── WebSocket: 메시지 수신 및 브로드캐스트 ────────────────────
    // 클라이언트가 /app/chat/{roomNo} 로 발행 → DB 저장 → /topic/chat/{roomNo} 로 전송
    // payload: { sender: "S" or "B", content: "메시지 본문" }
    @MessageMapping("/chat/{roomNo}")
    public void sendMessage(
            @DestinationVariable("roomNo") Long roomNo,
            Map<String, String> payload) {
        ChatMessage msg = new ChatMessage();
        msg.setRoomNo(roomNo);
        msg.setSender(payload.get("sender"));   // "S" 또는 "B"
        msg.setContent(payload.get("content"));
        msg.setSentDatetime(LocalDateTime.now());
        msg.setIsRead("N");

        ChatMessage saved = chatMessageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/chat/" + roomNo, saved);
    }
}
