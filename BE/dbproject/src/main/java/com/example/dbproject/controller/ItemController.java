package com.example.dbproject.controller;

import com.example.dbproject.entity.Item;
import com.example.dbproject.entity.ItemId;
import com.example.dbproject.repository.ChatMessageRepository;
import com.example.dbproject.repository.ChatRoomRepository;
import com.example.dbproject.repository.ItemRepository;
import com.example.dbproject.repository.PurchaseReqRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/items")
@CrossOrigin(origins = "http://localhost:5173")
public class ItemController {

    @Autowired private ItemRepository itemRepository;
    @Autowired private ChatRoomRepository chatRoomRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private PurchaseReqRepository purchaseReqRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    // 1. 전체 상품 목록
    @GetMapping
    public List<Item> getAllItems() {
        return itemRepository.findAll();
    }

    // 2. 특정 판매자의 상품 목록
    @GetMapping("/seller/{cno}")
    public List<Item> getItemsBySeller(@PathVariable("cno") String cno) {
        return itemRepository.findByCno(cno);
    }

    // 3. 상품 단건 조회
    @GetMapping("/{cno}/{itemNo}")
    public ResponseEntity<?> getItem(@PathVariable("cno") String cno, @PathVariable("itemNo") Long itemNo) {
        return itemRepository.findById(new ItemId(cno, itemNo))
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다."));
    }

    // 4. 상품 등록
    @PostMapping
    public ResponseEntity<Item> createItem(@RequestBody Item item) {
        Long maxNo = itemRepository.findMaxItemNoByCno(item.getCno());
        item.setItemNo((maxNo == null ? 0L : maxNo) + 1);
        item.setRegDateTime(LocalDateTime.now());
        if (item.getSellStatus() == null || item.getSellStatus().isBlank()) {
            item.setSellStatus("판매 중");
        }
        Item saved = itemRepository.save(item);
        messagingTemplate.convertAndSend("/topic/items", saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // 5. 상품 수정
    @PutMapping("/{cno}/{itemNo}")
    public ResponseEntity<?> updateItem(@PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Item req) {
        Optional<Item> opt = itemRepository.findById(new ItemId(cno, itemNo));
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        Item item = opt.get();
        item.setTitle(req.getTitle());
        item.setDescription(req.getDescription());
        item.setCategory(req.getCategory());
        item.setPrice(req.getPrice());
        item.setTradePlace(req.getTradePlace());
        if (req.getSellStatus() != null)
            item.setSellStatus(req.getSellStatus());
        Item saved = itemRepository.save(item);
        messagingTemplate.convertAndSend("/topic/items", saved);
        return ResponseEntity.ok(saved);
    }

    // 6. 판매 상태 변경
    @PatchMapping("/{cno}/{itemNo}/status")
    public ResponseEntity<?> updateStatus(@PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @RequestBody Map<String, String> body) {
        Optional<Item> opt = itemRepository.findById(new ItemId(cno, itemNo));
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        Item item = opt.get();
        String status = body.get("sellStatus");
        item.setSellStatus(status);
        if ("거래 완료".equals(status)) {
            item.setResDateTime(LocalDateTime.now());
        }
        Item saved = itemRepository.save(item);
        messagingTemplate.convertAndSend("/topic/items", saved);
        return ResponseEntity.ok(saved);
    }

    // 7. 상품 삭제
    @Transactional
    @DeleteMapping("/{cno}/{itemNo}")
    public ResponseEntity<?> deleteItem(@PathVariable("cno") String cno, @PathVariable("itemNo") Long itemNo) {
        ItemId id = new ItemId(cno, itemNo);
        if (!itemRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");
        }
        chatRoomRepository.findByCnoAndItemNo(cno, itemNo)
                .forEach(room -> chatMessageRepository.deleteByRoomNo(room.getRoomNo()));
        chatRoomRepository.deleteByCnoAndItemNo(cno, itemNo);
        purchaseReqRepository.deleteByCnoAndItemNo(cno, itemNo);
        itemRepository.deleteById(id);
        messagingTemplate.convertAndSend("/topic/items/delete", (Object) Map.of("cno", cno, "itemNo", itemNo));
        return ResponseEntity.noContent().build();
    }

    // 8. 이미지 업로드 (n = 1~3)
    @PostMapping("/{cno}/{itemNo}/pic/{n}")
    public ResponseEntity<?> uploadPic(@PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @PathVariable("n") int n,
            @RequestParam("file") MultipartFile file) throws IOException {
        if (n < 1 || n > 3) return ResponseEntity.badRequest().body("이미지 번호는 1~3이어야 합니다.");
        Optional<Item> opt = itemRepository.findById(new ItemId(cno, itemNo));
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");

        Item item = opt.get();
        byte[] bytes = file.getBytes();
        if (n == 1) item.setPic1(bytes);
        else if (n == 2) item.setPic2(bytes);
        else item.setPic3(bytes);
        itemRepository.save(item);

        return ResponseEntity.ok(Map.of("url", "/api/items/" + cno + "/" + itemNo + "/pic/" + n));
    }

    // 9. 이미지 삭제 (n = 1~3)
    @DeleteMapping("/{cno}/{itemNo}/pic/{n}")
    public ResponseEntity<?> deletePic(@PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @PathVariable("n") int n) {
        if (n < 1 || n > 3) return ResponseEntity.badRequest().body("이미지 번호는 1~3이어야 합니다.");
        Optional<Item> opt = itemRepository.findById(new ItemId(cno, itemNo));
        if (opt.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("상품을 찾을 수 없습니다.");

        Item item = opt.get();
        if (n == 1) item.setPic1(null);
        else if (n == 2) item.setPic2(null);
        else item.setPic3(null);
        itemRepository.save(item);
        return ResponseEntity.noContent().build();
    }

    // 10. 이미지 조회 (n = 1~3)
    @GetMapping("/{cno}/{itemNo}/pic/{n}")
    public ResponseEntity<byte[]> getPic(@PathVariable("cno") String cno,
            @PathVariable("itemNo") Long itemNo,
            @PathVariable("n") int n) {
        Optional<Item> opt = itemRepository.findById(new ItemId(cno, itemNo));
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        Item item = opt.get();
        byte[] bytes = n == 1 ? item.getPic1() : n == 2 ? item.getPic2() : item.getPic3();
        if (bytes == null || bytes.length == 0) return ResponseEntity.notFound().build();

        MediaType mediaType = detectMediaType(bytes);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header("Cache-Control", "public, max-age=86400")
                .body(bytes);
    }

    private MediaType detectMediaType(byte[] bytes) {
        if (bytes.length >= 4) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == 'P') return MediaType.IMAGE_PNG;
            if (bytes[0] == 'G' && bytes[1] == 'I') return MediaType.IMAGE_GIF;
            if (bytes[0] == 'R' && bytes[1] == 'I') return MediaType.parseMediaType("image/webp");
        }
        return MediaType.IMAGE_JPEG;
    }
}
