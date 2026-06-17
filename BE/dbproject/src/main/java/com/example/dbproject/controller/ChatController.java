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
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class ChatController {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // 채팅방 생성 또는 기존 채팅방 반환
    // body: { cno(구매자), receiveCno(판매자), itemNo }
    // DB 저장: room.cno = 판매자(FK_CHAT_ITEM 충족), room.receiveCno = 구매자
    @PostMapping("/api/chat/rooms")
    public ResponseEntity<?> getOrCreateRoom(@RequestBody Map<String, Object> body) {
        try {
            String buyerCno = (String) body.get("cno");
            String sellerCno = (String) body.get("receiveCno");
            Long itemNo = Long.valueOf(body.get("itemNo").toString());

            if (buyerCno == null || sellerCno == null) {
                return ResponseEntity.badRequest().body("cno, receiveCno 필드가 필요합니다.");
            }

            // 1. 두 사용자 사이에 이미 채팅방이 있으면 재활용 (역할 방향 무관)
            List<ChatRoom> existing = chatRoomRepository.findByPair(sellerCno, buyerCno);
            if (!existing.isEmpty()) {
                ChatRoom room = existing.get(0);
                // FK(CNO, ITEMNO) 위반 방지: 현재 거래 기준으로 판매자·구매자·상품 모두 갱신
                room.setCno(sellerCno);
                room.setReceiveCno(buyerCno);
                room.setItemNo(itemNo);
                return ResponseEntity.ok(chatRoomRepository.save(room));
            }

            // 2. 처음이면 새로 생성
            ChatRoom room = new ChatRoom();
            room.setCno(sellerCno);
            room.setReceiveCno(buyerCno);
            room.setItemNo(itemNo);
            room.setCreateDatetime(LocalDateTime.now());
            return ResponseEntity.ok(chatRoomRepository.save(room));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("채팅방 생성 실패: " + e.getMessage());
        }
    }

    // 특정 사용자의 채팅방 목록 조회
    @GetMapping("/api/chat/rooms/user/{cno}")
    public ResponseEntity<List<ChatRoom>> getRooms(@PathVariable("cno") String cno) {
        return ResponseEntity.ok(chatRoomRepository.findByCnoOrReceiveCno(cno, cno));
    }

    // 채팅방 메시지 내역 조회
    @GetMapping("/api/chat/rooms/{roomNo}/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable("roomNo") Long roomNo) {
        return ResponseEntity.ok(chatMessageRepository.findByRoomNoOrderBySentDatetimeAsc(roomNo));
    }

    // 채팅방 열 때 읽음 처리 — body: { mySender: "B" or "S" }
    @PatchMapping("/api/chat/rooms/{roomNo}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable("roomNo") Long roomNo,
                                           @RequestBody Map<String, String> body) {
        chatMessageRepository.markAsRead(roomNo, body.get("mySender"));
        return ResponseEntity.ok().build();
    }

    // 사용자의 채팅방별 안 읽은 메시지 수 목록
    // 반환: [ { roomNo, unreadCount }, ... ]
    @GetMapping("/api/chat/unread/{cno}")
    public ResponseEntity<List<Map<String, Object>>> getAllUnread(@PathVariable("cno") String cno) {
        List<ChatRoom> rooms = chatRoomRepository.findByCnoOrReceiveCno(cno, cno);
        List<Map<String, Object>> result = rooms.stream().map(room -> {
            String mySender = room.getReceiveCno().equals(cno) ? "B" : "S";
            Long count = chatMessageRepository.countUnread(room.getRoomNo(), mySender);
            Map<String, Object> entry = new HashMap<>();
            entry.put("roomNo", room.getRoomNo());
            entry.put("unreadCount", count);
            return entry;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // WebSocket: 메시지 수신 및 브로드캐스트
    // payload: { sender("S" or "B"), content }
    @MessageMapping("/chat/{roomNo}")
    public void sendMessage(@DestinationVariable("roomNo") Long roomNo, Map<String, String> payload) {
        ChatMessage msg = new ChatMessage();
        msg.setRoomNo(roomNo);
        msg.setSender(payload.get("sender"));   // "S" 또는 "B"
        msg.setContent(payload.get("content"));
        msg.setSentDatetime(LocalDateTime.now());
        msg.setIsRead("N");
        chatMessageRepository.save(msg);

        messagingTemplate.convertAndSend("/topic/chat/" + roomNo, msg);
    }
}
